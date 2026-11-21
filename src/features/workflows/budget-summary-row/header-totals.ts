import { defineSetting } from "@features/types";
import { BUDGET_TOTAL_LABELS } from "@lib/actual-dom";
import { SINGLE_MONTH_ATTR } from "./index";

/** The column totals, only where month cards mark the budget single-month: they show the same. */
const CSS = `
	[${SINGLE_MONTH_ATTR}] :is(${BUDGET_TOTAL_LABELS}) {
		display: none !important;
	}
`;

export const hideHeaderTotals = defineSetting({
	type: "checkbox",
	label: "Hide header totals",
	description:
		"With month cards on and one month shown, drops the column totals the cards already show.",
	icon: "eyeOff",
	group: "Budget",
	context: {
		key: "budget-hide-header-totals",
		defaultValue: false,
	},
	css: () => CSS,
});
