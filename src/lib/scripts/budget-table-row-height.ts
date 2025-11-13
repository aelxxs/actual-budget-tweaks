import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const budgetTableRowHeight = defineSetting({
	type: "select",
	label: "Row Height",
	options: [
		{ value: "2.25rem", label: "Normal (Default)" },
		{ value: "2rem", label: "Slim" },
		{ value: "1.74rem", label: "Extra Slim" },
		{ value: "2.65rem", label: "Relaxed" },
	],
	context: {
		key: "actual-slimmer-budgetrows",
		css: (value: string) => `
			div[data-testid="budget-totals"] + div div[data-testid="row"]:has(div[data-testid="category-name"]) {
				height: ${value};
				flex: 0 0 ${value};
			}
			div[data-testid="budget-totals"] + div div[data-testid="row"]:not(:has(div[data-testid="category-name"])) {
				height: ${value};
				flex: 0 0 ${value};
			}
		`,
		defaultValue: "2.25rem",
	},
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		if (ctx.css) {
			applyGlobalCSS(ctx.css(value), ctx.key);
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (ctx.css) {
			applyGlobalCSS(ctx.css(value), ctx.key);
		}
	},
});
