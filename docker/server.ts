// Sidecar: reverse-proxies to Actual, injecting the ABT bundle into the served HTML. No dependencies
// beyond Node's stdlib; Node runs this file directly, stripping its types.
import { createHash } from "node:crypto";
import fs from "node:fs";
import http, {
	type IncomingHttpHeaders,
	type IncomingMessage,
	type OutgoingHttpHeaders,
	type ServerResponse,
} from "node:http";
import https from "node:https";
import path from "node:path";

const PORT = Number(process.env.PORT || 3005);
const ACTUAL_ORIGIN = process.env.ACTUAL_ORIGIN || "http://actual:5006";
const ASSETS_DIR = process.env.ASSETS_DIR || "/assets";
const PACKAGE_JSON_PATH = process.env.PACKAGE_JSON_PATH || "/app/package.json";
const actualUrl = new URL(ACTUAL_ORIGIN);
const upstream = actualUrl.protocol === "https:" ? https : http;

// Read once at startup rather than per-request.
let ABT_VERSION = process.env.ABT_VERSION || "unknown";
if (!process.env.ABT_VERSION) {
	try {
		ABT_VERSION = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8")).version || ABT_VERSION;
	} catch (err) {
		console.warn(
			`[abt-sidecar] couldn't read version from ${PACKAGE_JSON_PATH}:`,
			(err as Error).message,
		);
	}
}

const SHIM = "browser-shim.js";
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

const CONTENT_TYPES: Record<string, string> = {
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json; charset=utf-8",
};

const INJECTION = `
		<script src="/abt/${SHIM}"></script>
		<script src="/abt/content-scripts/overlay-preload.js"></script>
		<link rel="stylesheet" href="/abt/css/base.css">
		<link rel="stylesheet" href="/abt/content-scripts/content.css">
		<script src="/abt/content-scripts/actual-api-bridge.js"></script>
		<script src="/abt/content-scripts/content.js"></script>
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

// Changes only when the injected shell does, so ABT releases don't trigger Actual's update prompt.
const SHELL_HASH = createHash("sha1").update(INJECTION).update(CSP).digest("hex").slice(0, 8);
const SW_SHELL_RE = /(\{url:["']\/?index\.html["'],revision:["'])([^"']+)(["']\})/;

function serveStatic(res: ServerResponse, urlPath: string): void {
	const rel = urlPath.slice("/abt/".length);
	const filePath = path.join(ASSETS_DIR, rel);
	// Trailing separator so a sibling like /assets-other can't pass the prefix check.
	if (!filePath.startsWith(ASSETS_DIR + path.sep)) {
		res.writeHead(400).end("bad path");
		return;
	}

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404).end("not found");
			return;
		}
		// Fixed URLs, unlike Actual's own content-hashed asset filenames — a
		// cached copy here has no reason to ever be re-requested otherwise.
		res.writeHead(200, {
			"Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		});
		res.end(rel === SHIM ? data.toString("utf8").replace("__ABT_VERSION__", ABT_VERSION) : data);
	});
}

async function handleYahooChart(
	req: IncomingMessage,
	res: ServerResponse,
	urlPath: string,
	search: string,
): Promise<void> {
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
		if (YAHOO_ALLOWED_PARAMS.has(key)) {
			target.searchParams.set(key, value);
		}
	}

	try {
		const reply = await fetch(target, { signal: AbortSignal.timeout(YAHOO_TIMEOUT_MS) });
		const body = Buffer.from(await reply.arrayBuffer());
		res.writeHead(reply.status, {
			"Content-Type": reply.headers.get("content-type") || "application/json",
			"X-Content-Type-Options": "nosniff",
		});
		res.end(body);
	} catch (err) {
		console.warn(`[abt-sidecar] yahoo relay failed for ${symbol}:`, (err as Error).message);
		res.writeHead(502).end();
	}
}

/** The request's headers as Actual should get them: no hop-by-hop ones, and who it came from. */
function forwardedHeaders(req: IncomingMessage): OutgoingHttpHeaders {
	const headers: OutgoingHttpHeaders = { ...req.headers, host: actualUrl.host };
	const connectionTokens = String(req.headers.connection || "")
		.split(",")
		.map((t) => t.trim().toLowerCase());
	for (const name of [...HOP_BY_HOP_HEADERS, ...connectionTokens]) {
		delete headers[name];
	}
	// Actual trusts X-Forwarded-For from private peers (this container), and keys
	// its login rate limit on it. Appending the real peer makes a client-supplied
	// value unable to stand in for the true address.
	const peer = req.socket.remoteAddress;
	if (peer) {
		const prior = req.headers["x-forwarded-for"];
		headers["x-forwarded-for"] = prior ? `${prior}, ${peer}` : peer;
	}
	// Kept from a TLS proxy in front, so Actual builds its redirects and cookies for the
	// address the browser used rather than this hop.
	headers["x-forwarded-proto"] ??= "http";
	headers["x-forwarded-host"] ??= req.headers.host;
	return headers;
}

function upstreamOptions(req: IncomingMessage, headers: OutgoingHttpHeaders) {
	return {
		hostname: actualUrl.hostname,
		port: actualUrl.port,
		method: req.method,
		path: req.url,
		headers,
	};
}

/** Buffers a response body, for the two responses that are rewritten on the way through. */
function readBody(res: IncomingMessage, done: (body: string) => void): void {
	const chunks: Buffer[] = [];
	res.on("data", (c: Buffer) => chunks.push(c));
	res.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
}

function withoutValidators(headers: IncomingHttpHeaders): IncomingHttpHeaders {
	const out = { ...headers };
	delete out["content-length"];
	delete out["etag"];
	delete out["last-modified"];
	return out;
}

function proxyToActual(req: IncomingMessage, res: ServerResponse): void {
	// Actual never compresses responses, so no accept-encoding dance needed.
	// Conditional-GET is stripped for everything (not just guessed "HTML"
	// requests) since guessing from the Accept header broke injection outright.
	const headers = forwardedHeaders(req);
	delete headers["if-none-match"];
	delete headers["if-modified-since"];

	const upstreamReq = upstream.request(upstreamOptions(req, headers), (upstreamRes) => {
		const status = upstreamRes.statusCode ?? 502;
		const contentType = upstreamRes.headers["content-type"] || "";
		// Actual's service worker precaches index.html; a new revision makes it refetch the
		// shell through here, so a cache from before the sidecar (or an older injection) clears.
		if (req.url?.split("?")[0] === "/sw.js" && contentType.includes("javascript")) {
			readBody(upstreamRes, (source) => {
				res.writeHead(status, withoutValidators(upstreamRes.headers));
				res.end(
					source.replace(
						SW_SHELL_RE,
						(_, before, revision, after) => `${before}${revision}-abt-${SHELL_HASH}${after}`,
					),
				);
			});
			return;
		}
		if (!contentType.includes("text/html")) {
			res.writeHead(status, upstreamRes.headers);
			upstreamRes.pipe(res);
			return;
		}

		// Buffer just the HTML shell so we can inject before </body>.
		readBody(upstreamRes, (html) => {
			const out = withoutValidators(upstreamRes.headers);
			delete out["content-security-policy-report-only"];
			out["content-security-policy"] = CSP;
			out["cache-control"] = "no-store";
			res.writeHead(status, out);
			res.end(html.includes("</body>") ? html.replace("</body>", INJECTION) : html + INJECTION);
		});
	});

	upstreamReq.on("error", (err) => {
		console.warn("[abt-sidecar] upstream error:", err.message);
		if (!res.headersSent) {
			res.writeHead(502);
		}
		res.end("Bad gateway");
	});
	req.pipe(upstreamReq);
}

const server = http.createServer((req, res) => {
	const [urlPath, search = ""] = (req.url ?? "/").split("?");
	if (urlPath.startsWith("/abt/")) {
		serveStatic(res, urlPath);
		return;
	}
	if (urlPath.startsWith(YAHOO_CHART_PREFIX) && req.method === "GET") {
		void handleYahooChart(req, res, urlPath, search ? `?${search}` : "");
		return;
	}
	proxyToActual(req, res);
});

server.listen(PORT, () => {
	console.log(`[abt-sidecar] listening on :${PORT}, proxying ${ACTUAL_ORIGIN}`);
});
