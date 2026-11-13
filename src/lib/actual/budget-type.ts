import { query } from "./actual-api";

export type BudgetType = "envelope" | "tracking";

/** Set on <html> once ABT starts on Actual, so CSS can tell the two budget types apart. */
export const BUDGET_TYPE_ATTR = "data-abt-budget-type";

// The last type seen, so features start right at load instead of correcting themselves after
// the pref is read; only the first load after switching type can be briefly wrong.
const STORAGE_KEY = "abt-budget-type";

function lastSeen(): BudgetType {
	try {
		return localStorage.getItem(STORAGE_KEY) === "tracking" ? "tracking" : "envelope";
	} catch {
		return "envelope";
	}
}

// Read lazily: the content script loads on every site, and this module with it.
let current: BudgetType | null = null;
const listeners = new Set<(type: BudgetType) => void>();

/** The open budget's type; until it's read, the last one seen. */
export function budgetType(): BudgetType {
	current ??= lastSeen();
	return current;
}

export function isTrackingBudget(): boolean {
	return budgetType() === "tracking";
}

/** Marks <html> with the last type seen, until `refreshBudgetType` reads the real one. */
export function markBudgetType(): void {
	document.documentElement.setAttribute(BUDGET_TYPE_ATTR, budgetType());
}

/** Calls `listener` whenever the budget type changes. Returns an unsubscribe. */
export function onBudgetType(listener: (type: BudgetType) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * Re-reads Actual's synced `budgetType` pref, which differs per budget file and changes when the
 * user switches type in Settings. Older budgets store "rollover" and "report".
 */
export async function refreshBudgetType(): Promise<BudgetType> {
	try {
		const [row] = await query<{ id: string; value: string }[]>("preferences", {
			filter: { id: "budgetType" },
		});
		const next: BudgetType =
			row?.value === "tracking" || row?.value === "report" ? "tracking" : "envelope";
		if (next !== budgetType()) {
			current = next;
			try {
				localStorage.setItem(STORAGE_KEY, next);
			} catch {
				// Only costs a moment's wrong guess at the next load.
			}
			for (const listener of listeners) {
				listener(next);
			}
		}
		markBudgetType();
	} catch {
		// Keeps the last known type.
	}
	return budgetType();
}
