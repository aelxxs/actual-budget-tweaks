import { getValue, hasValue, removeValue, setValue, watchValue } from "@lib/utilities/store";
import type { BuiltinTool, BuiltinWidget, Shortcut } from "./types";

// Kept per budget: links point at its accounts, and tickers follow its finances.
const STORAGE_KEY = "abt-sidebar-shortcuts";
const keyFor = (budgetId: string) => `${STORAGE_KEY}:${budgetId}`;

export const BUILTIN_TOOLS: BuiltinTool[] = [
	{ id: "calculator", label: "Calculator", icon: "svg:calc" },
	{ id: "currency-converter", label: "Currency Converter", icon: "svg:convert" },
	{ id: "interest-calculator", label: "Interest Calculator", icon: "svg:interest" },
];

export const BUILTIN_WIDGETS: BuiltinWidget[] = [
	{ id: "stock-tracker", label: "Stock Tracker", icon: "svg:stock" },
	{ id: "upcoming-schedules", label: "Upcoming Bills", icon: "svg:calendar" },
	{ id: "rsu-tracker", label: "RSU Tracker", icon: "svg:rsu" },
];

export async function loadShortcuts(budgetId: string): Promise<Shortcut[]> {
	// Shortcuts from before they were kept per budget go to the first budget opened.
	if (!(await hasValue(keyFor(budgetId))) && (await hasValue(STORAGE_KEY))) {
		await setValue(keyFor(budgetId), await getValue<Shortcut[]>(STORAGE_KEY, []));
		await removeValue(STORAGE_KEY);
	}
	return (await getValue<Shortcut[]>(keyFor(budgetId), [])) ?? [];
}

export function saveShortcuts(budgetId: string, items: Shortcut[]): Promise<void> {
	return setValue(keyFor(budgetId), items) as Promise<void>;
}

/** Follows edits from anywhere (the sidebar bar, the settings dialog, other tabs, a sync). */
export function watchShortcuts(
	budgetId: string,
	callback: (items: Shortcut[]) => void,
): () => void {
	return watchValue<Shortcut[]>(keyFor(budgetId), (items) => callback(items ?? []));
}
