export const TOGGLE_ATTR = "data-abt-tab";
export const PANEL_ID = "abt-template-drawer";
export const TRIGGER_ID = "abt-template-drawer-trigger";
export const LEGACY_PANEL_ID = "abt-tab-panel";
export const STORAGE_KEY = "abt-tab-data";
export const TAB_STORAGE_KEY = "abt-tab-active";
export const DRAWER_STORAGE_KEY = "abt-tab-drawer-open";
export const PRIO_COLLAPSE_STORAGE_KEY = "abt-tab-prio-collapse";

export type TriggerAction = "apply" | "overwrite" | "apply-single" | "apply-group";
export type PriorityValue = number | null | undefined;

// Menu-item button labels we hook. The app's React layer calls the backend
// via an internal `send()` (not window.$send), so wrapping window.$send
// misses these — we hook the click instead.
export const TRIGGER_LABELS = new Map<string, TriggerAction>([
	["apply budget template", "apply"],
	["apply budget templates", "apply"],
	["overwrite with budget template", "overwrite"],
	["overwrite with budget templates", "overwrite"],
	["apply template", "apply-single"], // single-category context menu
	["overwrite with template", "apply-single"],
	["overwrite with templates", "apply-group"],
]);

// Priority cache TTL. Goal/budget cells only change via apply/overwrite
// (handled explicitly) or manual budget edits (which we can't easily
// detect). 60s balances freshness against redundant recomputes.
export const PRIORITY_CACHE_MS = 60000;
export const REMAINDER_PRIORITY = 0;
export const PRIORITY_MODE = "overwrite";

export function priorityKey(priority: PriorityValue): string {
	return priority == null ? "remainder" : String(priority);
}

export function priorityLabel(priority: PriorityValue): string {
	return priority == null ? "Remainder" : `Priority ${priority}`;
}

export function comparePriority(a: PriorityValue, b: PriorityValue): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return a - b;
}
