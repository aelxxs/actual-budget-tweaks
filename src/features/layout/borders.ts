import { defineSetting } from "@features/types";
import { BUDGET_SCROLLER, BUDGET_SUMMARY, BUDGET_TOTALS } from "@lib/actual-dom";
import { getValue, hasValue, removeValue, setValue } from "@lib/store";

/** The top bar's border, also drawn by the modern page headers so they don't float under it. */
export const NAV_BORDER_CSS = `
	[data-abt-header] {
		border-bottom: 1px solid var(--abt-panel-border);
	}
	.abt-side-drawer-sidebar {
		border-top: none;
		border-top-left-radius: 0px;
	}
`;

const RETIRED_KEYS = ["header-border", "budget-page-borders", "report-card-borders"];

// The three switches this replaced: turning off any of them turns this off.
async function migrateRetiredSwitches(key: string) {
	if (await hasValue(key)) {
		return;
	}
	const stored = await Promise.all(RETIRED_KEYS.map((k) => hasValue(k)));
	if (!stored.some(Boolean)) {
		return;
	}
	const values = await Promise.all(RETIRED_KEYS.map((k) => getValue(k, true)));
	await setValue(key, values.every(Boolean));
	await Promise.all(RETIRED_KEYS.map(removeValue));
}

export const borders = defineSetting({
	type: "checkbox",
	label: "Borders",
	description: "Adds borders under the top bar and around the budget and report cards.",
	group: "General",
	icon: "square",
	context: {
		key: "borders",
		defaultValue: true,
	},
	init: ({ key }) => {
		void migrateRetiredSwitches(key);
	},
	css: () => `
		${NAV_BORDER_CSS}

		${BUDGET_SUMMARY},
		${BUDGET_TOTALS} {
			border: var(--border);
		}
		${BUDGET_SCROLLER} > div > div {
			border: var(--border);
			border-top: 0px;
		}

		.react-grid-item {
			border: var(--border);
		}
	`,
});
