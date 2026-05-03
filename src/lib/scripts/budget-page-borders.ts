import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const budgetPageBorders = defineSetting({
	type: "checkbox",
	label: "Budget Page Borders",
	context: {
		key: "budget-page-borders",
		defaultValue: true,
		css: () => `
            /* /budget -- budget cards */
            .css-1szeyz4,
            .css-1asnaqj {
                border: var(--border);
            }

            /* /budget -- table header */
            .css-d5wgg9 {
                border-inline: var(--border);
                border-top: var(--border);
            }

            /* /budget -- table body. */
            .css-1kx6xgs {
                border: var(--border);
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
