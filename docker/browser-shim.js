// Minimal window.browser polyfill so WXT code works
(function () {
	if (window.browser?.runtime?.id) return;

	const LOCAL_PREFIX = "local:";
	const changeListeners = [];

	function readLocalStorage(key) {
		try {
			const raw = localStorage.getItem(key);
			return raw === null ? undefined : JSON.parse(raw);
		} catch {
			return undefined;
		}
	}

	function writeLocalStorage(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// ignore
		}
	}

	// pin user-link to server location
	writeLocalStorage(LOCAL_PREFIX + "user-link", location.origin + "/");

	window.browser = {
		runtime: {
			id: "abt-sidecar-mvp",
			getURL: (path) => "/abt" + (path.startsWith("/") ? path : "/" + path),
			// Templated in by server.js from the repo's package.json at request
			getManifest: () => ({ version: "__ABT_VERSION__" }),
			onMessage: { addListener() { }, removeListener() { } },
			onInstalled: { addListener() { } },
			// Try direct fetch first; only Yahoo's chart API lacks CORS.
			sendMessage: async (message) => {
				if (message?.type !== "fetch") return undefined;
				try {
					const res = await fetch(message.url);
					if (!res.ok) return { ok: false, status: res.status };
					const text = await res.text();
					const data = message.responseType === "json" ? JSON.parse(text) : text;
					return { ok: true, data };
				} catch {
					// Likely a CORS block — fall through to the relay below.
				}
				try {
					const target = new URL(message.url);
					const match =
						target.hostname === "query2.finance.yahoo.com" &&
						target.pathname.match(/^\/v8\/finance\/chart\/(.+)$/);
					if (!match) return { ok: false, status: 0 };
					const res = await fetch(`/abt-api/yahoo-chart/${match[1]}${target.search}`);
					if (!res.ok) return { ok: false, status: res.status };
					const text = await res.text();
					const data = message.responseType === "json" ? JSON.parse(text) : text;
					return { ok: true, data };
				} catch {
					return { ok: false, status: 0 };
				}
			},
		},
		storage: {
			local: {
				get: async (keys) => {
					const list =
						typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
					const out = {};
					for (const k of list) {
						const v = readLocalStorage(k);
						if (v !== undefined) out[k] = v;
					}
					return out;
				},
				set: async (items) => {
					const changes = {};
					for (const [k, v] of Object.entries(items)) {
						changes[k] = { newValue: v };
						writeLocalStorage(k, v);
					}
					for (const cb of changeListeners) {
						try {
							cb(changes, "local");
						} catch {
							// ignore listener errors
						}
					}
				},
				// Only clear our own "local:"-prefixed keys — this origin's
				// localStorage also holds Actual's own app state.
				clear: async () => {
					const changes = {};
					for (const key of Object.keys(localStorage)) {
						if (!key.startsWith(LOCAL_PREFIX)) continue;
						changes[key] = { newValue: undefined };
						localStorage.removeItem(key);
					}
					for (const cb of changeListeners) {
						try {
							cb(changes, "local");
						} catch {
							// ignore listener errors
						}
					}
				},
			},
			onChanged: {
				addListener: (cb) => changeListeners.push(cb),
				removeListener: (cb) => {
					const i = changeListeners.indexOf(cb);
					if (i >= 0) changeListeners.splice(i, 1);
				},
			},
		},
		tabs: {
			query: async () => [],
			create: async ({ url }) => {
				window.location.href = url;
			},
		},
	};
})();
