import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const reportCardBorders = defineSetting({
	type: "checkbox",
	label: "Report Card Borders",
	context: {
		key: "report-card-borders",
		defaultValue: true,
		css: () => `
            .css-17nqm2r,
            .css-1mkkiaa,
            .css-s6nmt0,
            .css-o1urms {
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
