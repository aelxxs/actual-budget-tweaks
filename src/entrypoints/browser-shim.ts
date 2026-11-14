import type { Browser } from "wxt/browser";

// The sidecar's stand-in for the extension APIs ABT uses, loaded before its scripts. Each member is
// checked against the real API's type, so a signature ABT relies on can't drift from the extension's.
// Not loaded by the extension itself.
type StorageChanges = Record<string, Browser.storage.StorageChange>;
type ChangeListener = (changes: StorageChanges, areaName: string) => void;

const LOCAL_PREFIX = "local:";
// Templated in by the sidecar from the release's version as it serves this file.
const VERSION = "__ABT_VERSION__";

export default defineUnlistedScript(() => {
	if ((window as { browser?: { runtime?: { id?: string } } }).browser?.runtime?.id) {
		return;
	}

	const listeners: ChangeListener[] = [];
	const notify = (changes: StorageChanges) => {
		if (!Object.keys(changes).length) {
			return;
		}
		for (const listener of listeners) {
			try {
				listener(changes, "local");
			} catch {
				// A listener's error shouldn't stop the others.
			}
		}
	};

	const read = (key: string): unknown => {
		try {
			const raw = localStorage.getItem(key);
			return raw === null ? undefined : JSON.parse(raw);
		} catch {
			return undefined;
		}
	};
	const write = (key: string, value: unknown) => {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Full or blocked storage: the setting just doesn't persist.
		}
	};
	const ownKeys = () => Object.keys(localStorage).filter((k) => k.startsWith(LOCAL_PREFIX));

	// The extension's storage events reach every tab; localStorage's only reach the others.
	window.addEventListener("storage", (event) => {
		if (event.storageArea !== localStorage || !event.key?.startsWith(LOCAL_PREFIX)) {
			return;
		}
		const parse = (raw: string | null) => {
			try {
				return raw === null ? undefined : JSON.parse(raw);
			} catch {
				return undefined;
			}
		};
		notify({ [event.key]: { oldValue: parse(event.oldValue), newValue: parse(event.newValue) } });
	});

	// Yahoo's chart API sends no CORS headers, so its requests go through the sidecar's relay.
	const relayUrl = (url: string): string | null => {
		try {
			const target = new URL(url);
			const symbol =
				target.hostname === "query2.finance.yahoo.com" &&
				target.pathname.match(/^\/v8\/finance\/chart\/(.+)$/)?.[1];
			return symbol ? `/abt-api/yahoo-chart/${symbol}${target.search}` : null;
		} catch {
			return null;
		}
	};

	const get = (async (keys?: string | string[] | Record<string, unknown> | null) => {
		// null asks for everything, as the settings export does.
		const list =
			keys == null
				? ownKeys()
				: typeof keys === "string"
					? [keys]
					: Array.isArray(keys)
						? keys
						: Object.keys(keys);
		const out: Record<string, unknown> = {};
		for (const key of list) {
			const value = read(key);
			if (value !== undefined) {
				out[key] = value;
			}
		}
		return out;
	}) as Browser.storage.StorageArea["get"];

	const set = (async (items: Record<string, unknown>) => {
		const changes: StorageChanges = {};
		for (const [key, value] of Object.entries(items)) {
			changes[key] = { oldValue: read(key), newValue: value };
			write(key, value);
		}
		notify(changes);
	}) satisfies Browser.storage.StorageArea["set"];

	const remove = (async (keys: string | string[]) => {
		const changes: StorageChanges = {};
		for (const key of typeof keys === "string" ? [keys] : keys) {
			if (localStorage.getItem(key) === null) {
				continue;
			}
			changes[key] = { oldValue: read(key) };
			localStorage.removeItem(key);
		}
		notify(changes);
	}) satisfies Browser.storage.StorageArea["remove"];

	// Only ABT's own keys: this origin's localStorage also holds Actual's state.
	const clear = (async () => {
		const changes: StorageChanges = {};
		for (const key of ownKeys()) {
			changes[key] = { oldValue: read(key) };
			localStorage.removeItem(key);
		}
		notify(changes);
	}) satisfies Browser.storage.StorageArea["clear"];

	const sendMessage = async (message: { type?: string; url?: string; responseType?: string }) => {
		if (message?.type !== "fetch" || !message.url) {
			console.warn("[abt-sidecar] no handler for message", message);
			return undefined;
		}
		try {
			const res = await fetch(relayUrl(message.url) ?? message.url);
			if (!res.ok) {
				return { ok: false, status: res.status };
			}
			const text = await res.text();
			return { ok: true, data: message.responseType === "json" ? JSON.parse(text) : text };
		} catch {
			return { ok: false, status: 0 };
		}
	};

	// The sidecar's own address; the popup's "open Actual" link uses it.
	write(`${LOCAL_PREFIX}user-link`, `${location.origin}/`);

	const noop = { addListener() {}, removeListener() {} };
	Object.assign(window, {
		browser: {
			runtime: {
				id: "abt-sidecar",
				getURL: ((path: string) => `/abt${path.startsWith("/") ? path : `/${path}`}`) satisfies (
					path: string,
				) => string,
				getManifest: () => ({ version: VERSION }) as Browser.runtime.Manifest,
				onMessage: noop,
				onInstalled: noop,
				sendMessage,
			},
			storage: {
				local: { get, set, remove, clear },
				onChanged: {
					addListener: (listener: ChangeListener) => listeners.push(listener),
					removeListener: (listener: ChangeListener) => {
						const i = listeners.indexOf(listener);
						if (i >= 0) {
							listeners.splice(i, 1);
						}
					},
				},
			},
			tabs: {
				query: async () => [],
				// A new tab, as the extension opens one, rather than leaving Actual.
				create: async ({ url }: { url?: string }) => {
					if (url) {
						window.open(url, "_blank", "noopener");
					}
				},
			},
		},
	});
});
