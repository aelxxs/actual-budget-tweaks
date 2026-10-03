// Sidecar: reverse-proxies to Actual, injecting the ABT bundle into the
// served HTML. No dependencies beyond Node's stdlib.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3005);
const ACTUAL_ORIGIN = process.env.ACTUAL_ORIGIN || "http://actual:5006";
const ASSETS_DIR = process.env.ASSETS_DIR || "/assets";
const PACKAGE_JSON_PATH = process.env.PACKAGE_JSON_PATH || "/app/package.json";
const actualUrl = new URL(ACTUAL_ORIGIN);

// Read once at startup rather than per-request.
let ABT_VERSION = "unknown";
try {
	ABT_VERSION = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8")).version || ABT_VERSION;
} catch (err) {
	console.warn(`[abt-sidecar] couldn't read version from ${PACKAGE_JSON_PATH}:`, err.message);
}

const YAHOO_CHART_PREFIX = "/abt-api/yahoo-chart/";
const SYMBOL_RE = /^[A-Za-z0-9.\-^=]{1,20}$/;
// Only what ABT's stock widgets send; anything else is dropped, not relayed.
const YAHOO_ALLOWED_PARAMS = new Set(["interval", "range", "period1", "period2"]);
const YAHOO_TIMEOUT_MS = 10_000;

// Connection-scoped headers a proxy must not forward (RFC 9110 §7.6.1).
const HOP_BY_HOP_HEADERS = [
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
];

const CONTENT_TYPES = {
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json; charset=utf-8",
};

const INJECTION = `
		<script src="/abt/browser-shim.js"></script>
		<link rel="stylesheet" href="/abt/css/base.css">
		<link rel="stylesheet" href="/abt/content-scripts/content.css">
		<script src="/abt/content-scripts/actual-api-bridge.js"></script>
		<script src="/abt/content-scripts/content.js"></script>
		<script src="/abt/content-scripts/income-breakdown.js"></script>
	</body>`;

const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	// t1.gstatic.com: favicon.ts's getFaviconUrl() (account/shortcut icons).
	// cdn.jsdelivr.net: Twemoji SVGs for the account icon emoji picker.
	"img-src 'self' data: blob: https://t1.gstatic.com https://cdn.jsdelivr.net",
	"font-src 'self' data:",
	// api.github.com: Actual's own update-check, not ABT's. More hosts may
	// surface here as Actual's own features get exercised (e.g. bank sync).
	"connect-src 'self' https://query2.finance.yahoo.com https://raw.githubusercontent.com https://api.exchangerate-api.com https://api.github.com",
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'self'",
].join("; ");

function serveStatic(req, res, urlPath) {
	const rel = urlPath.slice("/abt/".length);
	const filePath =
		rel === "browser-shim.js"
			? path.join(__dirname, "browser-shim.js")
			: path.join(ASSETS_DIR, rel);

	const base = rel === "browser-shim.js" ? __dirname : ASSETS_DIR;
	// Trailing separator so a sibling like /assets-other can't pass the prefix check.
	if (!filePath.startsWith(base + path.sep)) {
		res.writeHead(400).end("bad path");
		return;
	}

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404).end("not found");
			return;
		}
		const ext = path.extname(filePath);
		// Fixed URLs, unlike Actual's own content-hashed asset filenames — a
		// cached copy here has no reason to ever be re-requested otherwise.
		res.writeHead(200, {
			"Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		});
		if (rel === "browser-shim.js") {
			res.end(data.toString("utf8").replace("__ABT_VERSION__", ABT_VERSION));
			return;
		}
		res.end(data);
	});
}

async function handleYahooChart(req, res, urlPath, search) {
	// No auth of its own — require same-origin. GETs often omit Origin, so
	// fall back to Referer.
	const expectedOrigin = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
	const { origin, referer } = req.headers;
	const sameOrigin = origin
		? origin === expectedOrigin
		: !!referer?.startsWith(`${expectedOrigin}/`);
	if (!sameOrigin) {
		res.writeHead(403).end();
		return;
	}

	const symbol = decodeURIComponent(urlPath.slice(YAHOO_CHART_PREFIX.length));
	if (!SYMBOL_RE.test(symbol)) {
		res.writeHead(400).end();
		return;
	}

	const target = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`);
	for (const [key, value] of new URLSearchParams(search)) {
		if (YAHOO_ALLOWED_PARAMS.has(key)) target.searchParams.set(key, value);
	}

	try {
		const upstream = await fetch(target, { signal: AbortSignal.timeout(YAHOO_TIMEOUT_MS) });
		const body = Buffer.from(await upstream.arrayBuffer());
		res.writeHead(upstream.status, {
			"Content-Type": upstream.headers.get("content-type") || "application/json",
			"X-Content-Type-Options": "nosniff",
		});
		res.end(body);
	} catch (err) {
		console.warn(`[abt-sidecar] yahoo relay failed for ${symbol}:`, err.message);
		res.writeHead(502).end();
	}
}

function proxyToActual(req, res) {
	// Actual never compresses responses, so no accept-encoding dance needed.
	// Conditional-GET is stripped for everything (not just guessed "HTML"
	// requests) since guessing from the Accept header broke injection outright.
	const outHeaders = { ...req.headers, host: actualUrl.host };
	delete outHeaders["if-none-match"];
	delete outHeaders["if-modified-since"];
	const connectionTokens = String(req.headers.connection || "")
		.split(",")
		.map((t) => t.trim().toLowerCase());
	for (const name of [...HOP_BY_HOP_HEADERS, ...connectionTokens]) delete outHeaders[name];
	// Actual trusts X-Forwarded-For from private peers (this container), and keys
	// its login rate limit on it. Appending the real peer makes a client-supplied
	// value unable to stand in for the true address.
	const peer = req.socket.remoteAddress;
	if (peer) {
		const prior = req.headers["x-forwarded-for"];
		outHeaders["x-forwarded-for"] = prior ? `${prior}, ${peer}` : peer;
	}

	const upstreamReqOpts = {
		protocol: actualUrl.protocol,
		hostname: actualUrl.hostname,
		port: actualUrl.port,
		method: req.method,
		path: req.url,
		headers: outHeaders,
	};
	const upstreamReq = http.request(upstreamReqOpts, (upstreamRes) => {
		const contentType = upstreamRes.headers["content-type"] || "";
		if (!contentType.includes("text/html")) {
			const headers = { ...upstreamRes.headers };
			res.writeHead(upstreamRes.statusCode, headers);
			upstreamRes.pipe(res);
			return;
		}

		// Buffer just the HTML shell so we can inject before </body>.
		const chunks = [];
		upstreamRes.on("data", (c) => chunks.push(c));
		upstreamRes.on("end", () => {
			const html = Buffer.concat(chunks).toString("utf8");
			const injected = html.includes("</body>")
				? html.replace("</body>", INJECTION)
				: html + INJECTION;
			const headers = { ...upstreamRes.headers };
			delete headers["content-length"];
			delete headers["content-security-policy-report-only"];
			delete headers["etag"];
			delete headers["last-modified"];
			headers["content-security-policy"] = CSP;
			headers["cache-control"] = "no-store";
			res.writeHead(upstreamRes.statusCode, headers);
			res.end(injected);
		});
	});

	upstreamReq.on("error", (err) => {
		console.warn("[abt-sidecar] upstream error:", err.message);
		if (!res.headersSent) res.writeHead(502);
		res.end("Bad gateway");
	});
	req.pipe(upstreamReq);
}

const server = http.createServer((req, res) => {
	const [urlPath, search = ""] = req.url.split("?");
	if (urlPath.startsWith("/abt/")) return serveStatic(req, res, urlPath);
	if (urlPath.startsWith(YAHOO_CHART_PREFIX) && req.method === "GET") {
		return handleYahooChart(req, res, urlPath, search ? `?${search}` : "");
	}
	return proxyToActual(req, res);
});

server.listen(PORT, () => {
	console.log(`[abt-sidecar] listening on :${PORT}, proxying ${ACTUAL_ORIGIN}`);
});
