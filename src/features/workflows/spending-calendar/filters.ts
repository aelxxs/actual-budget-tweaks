import type { BaseFilters } from "@features/workflows/filters/types";
import { getValue, setValue } from "@lib/utilities/store";

export type { Flow } from "@features/workflows/filters/types";

export interface CalendarFilters extends BaseFilters {
	showScheduled: boolean;
	showBalance: boolean;
}

/** What "Clear all" restores; off-budget accounts and balances stay as chosen, since they're view preferences. */
export const CLEARED: Pick<
	CalendarFilters,
	"flow" | "showScheduled" | "hiddenAccounts" | "hiddenCategories"
> = { flow: "all", showScheduled: true, hiddenAccounts: [], hiddenCategories: [] };

const FILTERS_KEY = "spending-calendar-filters";
const LEGACY_OFFBUDGET_KEY = "spending-calendar-hide-offbudget";

export async function loadFilters(): Promise<CalendarFilters> {
	const hideOffBudget = await getValue(LEGACY_OFFBUDGET_KEY, true);
	const saved = await getValue<Partial<CalendarFilters>>(FILTERS_KEY, {});
	return { ...CLEARED, hideOffBudget, showBalance: false, ...saved };
}

export function saveFilters(filters: CalendarFilters): Promise<void> {
	return setValue(FILTERS_KEY, filters);
}
