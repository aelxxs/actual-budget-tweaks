export type Flow = "all" | "spending" | "income";

/** What every page's filter shares; a page adds its own switches next to these. */
export interface BaseFilters {
	flow: Flow;
	hideOffBudget: boolean;
	/** Hidden rather than shown ids, so accounts and categories added later show by default. */
	hiddenAccounts: string[];
	hiddenCategories: string[];
}
