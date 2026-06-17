import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue } from "@lib/utilities/store";
import RowHeightPicker from "./Picker.svelte";

export const budgetTableRowHeight = defineSetting({
	type: "custom",
	label: "Budget Table Row Height",
	context: {
		key: "actual-slimmer-budgetrows",
		defaultValue: "2.25rem",
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
	},
	component: RowHeightPicker,
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		applyGlobalCSS(ctx.css(value as string), ctx.key);
	},
});
