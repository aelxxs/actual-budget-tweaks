import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { SelectSetting } from "./types";

export const reportWidgetBackgroundColor: SelectSetting = {
	type: "select",
	label: "Report Card Color",
	options: [
		{ label: "Light (Default)", value: "var(--color-tableBackground)" },
		{ label: "Dark", value: "var(--ctp-crust)" },
	],
	context: {
		key: "report-card-color",
		defaultValue: "var(--color-tableBackground)",
		css: (value) => `
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
		if (value && ctx.css) {
			applyGlobalCSS(ctx.css(), ctx.key);
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (ctx.css) {
			applyGlobalCSS(ctx.css(), ctx.key);
		}
	},
};
