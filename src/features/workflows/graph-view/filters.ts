import { getValue, setValue } from "@lib/utilities/store";
import type { GraphFilters } from "./data";

export const CLEARED: GraphFilters = {
	flow: "all",
	hideOffBudget: false,
	hiddenAccounts: [],
	hiddenCategories: [],
};

const FILTERS_KEY = "graph-view-filters";

export async function loadFilters(): Promise<GraphFilters> {
	return { ...CLEARED, ...(await getValue<Partial<GraphFilters>>(FILTERS_KEY, {})) };
}

export function saveFilters(filters: GraphFilters): Promise<void> {
	return setValue(FILTERS_KEY, filters);
}
