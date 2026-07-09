import { getValue, setValue } from "./store";

const STORAGE_KEY = "category-colors";

const DEFAULTS = [
	"#7c5cbf", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
	"#ec4899", "#0ea5e9", "#a855f7", "#14b8a6", "#f97316",
	"#8b5cf6", "#06b6d4", "#84cc16", "#e11d48", "#6366f1",
];

let colors: Record<string, string> = {};
let loaded = false;
let autoIndex = 0;

export async function loadCategoryColors(): Promise<void> {
	if (loaded) return;
	colors = await getValue<Record<string, string>>(STORAGE_KEY, {});
	loaded = true;
}

export function getCategoryColor(categoryId: string): string {
	if (!categoryId) return "#666";
	if (colors[categoryId]) return colors[categoryId];
	const color = DEFAULTS[autoIndex % DEFAULTS.length];
	autoIndex++;
	colors[categoryId] = color;
	return color;
}

export async function setCategoryColor(categoryId: string, color: string): Promise<void> {
	colors[categoryId] = color;
	await setValue(STORAGE_KEY, { ...colors });
}

export function getAllCategoryColors(): Record<string, string> {
	return { ...colors };
}

export const PRESET_COLORS = [
	"#ef4444", "#f97316", "#f59e0b", "#eab308",
	"#84cc16", "#22c55e", "#10b981", "#14b8a6",
	"#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
	"#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
	"#f43f5e", "#78716c", "#64748b", "#475569",
];
