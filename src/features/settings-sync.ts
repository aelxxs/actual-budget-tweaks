import { notify, send } from "@lib/utilities/actual-api";
import { watchDom } from "@lib/utilities/dom-watcher";
import { createLogger } from "@lib/utilities/logger";
import { getValue, hasValue, onSetValue, setValue } from "@lib/utilities/store";
import { reapplySetting } from "./runtime";
import type { Setting } from "./types";

const log = createLogger("sync");

/** Actual's synced prefs are one table shared with its own keys; ours never collide. */
const PREFIX = "abt:";
const BUDGET_LOADED = 'a[href="/budget"]';
/** Settings kept outside a setting's own key: theme customisations and per-category/account looks. */
const EXTRA_KEYS = [
	"theme-auto-switch",
	"theme-auto-dark",
	"theme-auto-light",
	"user-themes",
	"category-colors",
	"abt-account-icons",
	"abt-category-icons",
];

let applying = false;
const synced = new Set(EXTRA_KEYS);

const isBudgetLoaded = () => !!document.querySelector(BUDGET_LOADED);

// Chrome's storage hands objects back with their keys sorted, so key order can't count.
function sameValue(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ak = Object.keys(a);
	const bk = Object.keys(b);
	if (ak.length !== bk.length) return false;
	return ak.every(
		(k) =>
			k in b && sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
	);
}

function push(key: string, value: unknown): Promise<void> {
	log.info(`saving "${key}" to the budget`);
	return send<void>("preferences/save", { id: PREFIX + key, value: JSON.stringify(value) }).catch(
		(err) => log.error(`failed to save "${key}"`, err),
	);
}

/** Saves every stored setting to the open budget, for writes that bypass setValue (imports). */
export async function pushStoredSettings(): Promise<void> {
	if (!isBudgetLoaded()) return;
	const keys = [...synced];
	const stored = await Promise.all(keys.map(async (key) => ((await hasValue(key)) ? key : null)));
	await Promise.all(
		stored.filter((key) => key !== null).map(async (key) => push(key, await getValue(key, null))),
	);
}

/**
 * Settings follow the open budget: its values win, and ones it doesn't have yet are seeded
 * from this browser. Browser storage stays the cache that every page paints from.
 */
export function startSettingsSync(settings: Setting[]): () => void {
	const live = new Map<string, Setting>();
	for (const s of settings) {
		if (s.type === "core") continue;
		synced.add(s.context.key);
		if (s.type !== "custom") live.set(s.context.key, s);
	}

	onSetValue((key, value) => {
		if (!applying && synced.has(key) && isBudgetLoaded()) void push(key, value);
	});

	let pulling: Promise<void> | null = null;
	let again = false;

	async function pull(): Promise<void> {
		// Actual only fetches other devices' changes when it syncs; local budgets just error.
		await send("sync").catch(() => {});
		const prefs = await send<Record<string, string | null | undefined>>("preferences/get");
		const needsReload: string[] = [];
		for (const key of synced) {
			const remote = prefs[PREFIX + key];
			if (remote === undefined) {
				if (await hasValue(key)) void push(key, await getValue(key, null));
				continue;
			}
			// Undoing the first save of a key leaves its row empty; keep what this browser has.
			if (remote === null) continue;
			// getValue reads a stored null as missing, which would never match the budget's "null".
			const local = (await hasValue(key)) ? await getValue<unknown>(key, null) : undefined;
			let value: unknown;
			try {
				value = JSON.parse(remote);
			} catch {
				continue;
			}
			if (local !== undefined && sameValue(local, value)) continue;
			log.info(`adopting "${key}" from the budget`);
			applying = true;
			try {
				await setValue(key, value);
			} finally {
				applying = false;
			}
			const setting = live.get(key);
			if (setting) await reapplySetting(setting, value);
			else needsReload.push(key);
		}
		if (needsReload.length) {
			log.info("synced settings that need a reload", needsReload);
			await notify(
				{
					message: "Some ABT settings changed in this budget. Reload to apply them.",
					sticky: true,
				},
				{ title: "Reload", action: () => location.reload() },
			);
		}
	}

	// Coalesced, so a burst of triggers runs at most one more pull after the current one.
	function schedulePull(): void {
		if (!isBudgetLoaded()) return;
		if (pulling) {
			again = true;
			return;
		}
		pulling = pull()
			.catch((err) => log.error("pull failed", err))
			.finally(() => {
				pulling = null;
				if (again) {
					again = false;
					schedulePull();
				}
			});
	}

	// A budget opening (or switching to another) is the cue to adopt its settings.
	let loaded = false;
	const unwatch = watchDom(() => {
		const now = isBudgetLoaded();
		if (now && !loaded) schedulePull();
		loaded = now;
	});
	loaded = isBudgetLoaded();
	if (loaded) schedulePull();

	// Actual exposes no event for other devices' changes or for Ctrl+Z reverting ours, so
	// re-check when either is likely. Focus covers switching windows, which isn't a visibility change.
	const onFocus = () => schedulePull();
	const onVisible = () => document.visibilityState === "visible" && schedulePull();
	const onKey = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") setTimeout(schedulePull, 300);
	};
	window.addEventListener("focus", onFocus);
	document.addEventListener("visibilitychange", onVisible);
	document.addEventListener("keydown", onKey, true);

	return () => {
		onSetValue(null);
		unwatch();
		window.removeEventListener("focus", onFocus);
		document.removeEventListener("visibilitychange", onVisible);
		document.removeEventListener("keydown", onKey, true);
	};
}
