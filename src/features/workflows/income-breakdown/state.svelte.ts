import { getValue, hasValue, setValue, watchValue } from "@lib/store";
import { type BreakdownOptions, DEFAULT_OPTIONS } from "./data";

const OPTIONS_KEY = "income-breakdown-options";
const LEGACY_PREFIX = "abt-income-breakdown-";
const LEGACY_KEYS: Record<string, keyof BreakdownOptions> = {
	activePreset: "preset",
	startDate: "start",
	endDate: "end",
	showIncome: "showIncome",
	showExpense: "showExpense",
	showSubCategories: "showSubCategories",
	showLossGain: "showLossGain",
	groupPositiveCategories: "groupPositive",
};

/** Shared by every Income Breakdown widget, as before. */
export const breakdown = $state({ options: { ...DEFAULT_OPTIONS }, editing: false });

// The widget used to keep these in the page's localStorage, one key each.
function takeLegacy(): Partial<BreakdownOptions> {
	const found: Record<string, unknown> = {};
	for (const [legacy, key] of Object.entries(LEGACY_KEYS)) {
		const raw = localStorage.getItem(LEGACY_PREFIX + legacy);
		if (raw !== null) {
			try {
				found[key] = JSON.parse(raw);
			} catch {
				// Skipped; the default stands.
			}
			localStorage.removeItem(LEGACY_PREFIX + legacy);
		}
	}
	return found as Partial<BreakdownOptions>;
}

export async function loadOptions(): Promise<() => void> {
	const stored = (await hasValue(OPTIONS_KEY))
		? await getValue<Partial<BreakdownOptions>>(OPTIONS_KEY, {})
		: takeLegacy();
	breakdown.options = { ...DEFAULT_OPTIONS, ...stored };
	return watchValue<BreakdownOptions>(OPTIONS_KEY, (value) => {
		breakdown.options = { ...DEFAULT_OPTIONS, ...value };
	});
}

export function setOptions(patch: Partial<BreakdownOptions>): void {
	breakdown.options = { ...breakdown.options, ...patch };
	void setValue(OPTIONS_KEY, $state.snapshot(breakdown.options));
}
