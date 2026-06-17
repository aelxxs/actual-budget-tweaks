import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

export const reportCardBorders = defineSetting({
	type: "checkbox",
	label: "Report Card Borders",
	context: {
		key: "report-card-borders",
		defaultValue: true,
		css: () => `
			.react-grid-item {
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
