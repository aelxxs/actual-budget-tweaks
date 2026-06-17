import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

export const budgetPageBorders = defineSetting({
	type: "checkbox",
	label: "Budget Page Borders",
	context: {
		key: "budget-page-borders",
		defaultValue: true,
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
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled) {
			applyGlobalCSS(ctx.css(), ctx.key);
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (value) {
			applyGlobalCSS(ctx.css(), ctx.key);
		} else {
			applyGlobalCSS("", ctx.key);
		}
	},
});
