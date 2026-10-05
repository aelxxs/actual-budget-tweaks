import { getValue, setValue, watchValue } from "@lib/utilities/store";
import type { BuiltinTool, BuiltinWidget, Shortcut } from "./types";

const STORAGE_KEY = "abt-sidebar-shortcuts";

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

export async function loadShortcuts(): Promise<Shortcut[]> {
	return (await getValue<Shortcut[]>(STORAGE_KEY, [])) ?? [];
}

export function saveShortcuts(items: Shortcut[]): Promise<void> {
	return setValue(STORAGE_KEY, items) as Promise<void>;
}

/** Follows edits from anywhere (the sidebar bar, the settings dialog, other tabs). */
export function watchShortcuts(callback: (items: Shortcut[]) => void): () => void {
	return watchValue<Shortcut[]>(STORAGE_KEY, (items) => callback(items ?? []));
}
