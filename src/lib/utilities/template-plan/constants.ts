export const PRIO_COLLAPSE_STORAGE_KEY = "abt-tab-prio-collapse";

export type TriggerAction = "apply" | "overwrite" | "apply-single" | "apply-group";
export type PriorityValue = number | null | undefined;

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
