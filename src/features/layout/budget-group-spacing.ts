import { defineSetting } from "@features/types";
import { BUDGET_TABLE, ROW } from "@lib/actual-dom";
import { desktopOnly } from "@lib/utilities/pages";

// Taller rather than spaced apart: a gap between rows reads as a break in the table.
const HEIGHT = "calc(var(--abt-budget-row-height, 2.25rem) + var(--abt-space-2))";

export const budgetGroupSpacing = defineSetting({
	type: "checkbox",
	label: "Taller Group Rows",
	description: "Makes category group rows taller so each group stands apart from its categories.",
	group: "Budget",
	icon: "rows",
	context: {
		key: "budget-group-spacing",
		defaultValue: false,
	},
	css: () =>
		desktopOnly(`
			${BUDGET_TABLE} [data-abt-budget-group] > ${ROW} {
				height: ${HEIGHT};
				flex: 0 0 ${HEIGHT};
			}
		`),
});
