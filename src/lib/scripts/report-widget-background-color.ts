import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const reportWidgetBackgroundColor = defineSetting({
	type: "select",
	label: "Report Card Color",
	options: [
		{ label: "Light (Default)", value: "var(--color-tableBackground)" },
		{ label: "Dark", value: "var(--ctp-crust)" },
	],
	context: {
		key: "report-card-color",
		defaultValue: "var(--color-tableBackground)",
		css: (value: string) => `
			.css-s6nmt0,
			.css-o1urms {
				width: 100%;
				height: 100%;
				transition: box-shadow 0.25s;
				background-color: ${value};
			}
		`,
	},
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		if (value) {
			applyGlobalCSS(ctx.css(value), ctx.key);
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		applyGlobalCSS(ctx.css(value), ctx.key);
	},
});
