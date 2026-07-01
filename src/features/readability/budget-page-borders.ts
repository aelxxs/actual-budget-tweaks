import { defineSetting } from "@features/types";

export const budgetPageBorders = defineSetting({
	type: "checkbox",
	label: "Budget Page Borders",
	context: {
		key: "budget-page-borders",
		defaultValue: true,
	},
	css: () => `
		/* /budget -- budget cards */
		[data-testid="budget-summary"] {
			border: var(--border);
		}

		/* /budget -- table header */
		[data-testid="budget-totals"] {
			border: var(--border);
		}

		/* /budget -- table body. */
		.css-5co8lf {
			border: var(--border);
			border-top: 0px;
		}
	`,
});
