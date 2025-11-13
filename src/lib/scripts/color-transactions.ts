import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const colorTransactions = defineSetting({
	type: "checkbox",
	label: "Color Transactions",
	context: {
		key: "actual-amountcolors",
		defaultValue: true,
		css: () => `
			*[data-testid='credit'] {
				color: var(--color-noticeText) !important;
			}
			*[data-testid='debit'] {
				color: var(--color-errorText) !important;
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
