import { getValue, setValue, watchValue } from "./store";

const STORAGE_KEY = "category-colors";

const DEFAULTS = [
	"#7c5cbf",
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#ec4899",
	"#0ea5e9",
	"#a855f7",
	"#14b8a6",
	"#f97316",
	"#8b5cf6",
	"#06b6d4",
	"#84cc16",
	"#e11d48",
	"#6366f1",
];

// Picked colours are state, so pages redraw when another device's arrive through settings sync.
const picked = $state<{ map: Record<string, string> }>({ map: {} });
// Handed out on first use to categories without one, and saved with the next pick.
const auto: Record<string, string> = {};
const listeners = new Set<() => void>();
let loaded = false;
let autoIndex = 0;

export async function loadCategoryColors(): Promise<void> {
	if (loaded) {
		return;
	}
	loaded = true;
	picked.map = await getValue<Record<string, string>>(STORAGE_KEY, {});
	watchValue<Record<string, string>>(STORAGE_KEY, (next) => {
		picked.map = next ?? {};
		for (const listener of listeners) {
			listener();
		}
	});
}

/** Calls back whenever the saved colours change, here or from another device. */
export function onCategoryColorsChange(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getCategoryColor(categoryId: string): string {
	if (!categoryId) {
		return "#666";
	}
	const own = picked.map[categoryId] ?? auto[categoryId];
	if (own) {
		return own;
	}
	const color = DEFAULTS[autoIndex % DEFAULTS.length];
	autoIndex++;
	auto[categoryId] = color;
	return color;
}

export async function setCategoryColor(categoryId: string, color: string): Promise<void> {
	picked.map = { ...picked.map, [categoryId]: color };
	await setValue(STORAGE_KEY, { ...auto, ...picked.map });
}

export function getAllCategoryColors(): Record<string, string> {
	return { ...auto, ...picked.map };
}

export const PRESET_COLORS = [
	"#ef4444",
	"#f97316",
	"#f59e0b",
	"#eab308",
	"#84cc16",
	"#22c55e",
	"#10b981",
	"#14b8a6",
	"#06b6d4",
	"#0ea5e9",
	"#3b82f6",
	"#6366f1",
	"#8b5cf6",
	"#a855f7",
	"#d946ef",
	"#ec4899",
	"#f43f5e",
	"#78716c",
	"#64748b",
	"#475569",
];
