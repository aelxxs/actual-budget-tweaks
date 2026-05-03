import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const headerBorder = defineSetting({
	type: "checkbox",
	label: "Header Border",
	context: {
		key: "header-border",
		defaultValue: true,
		css: () => `
            .css-lcyxda {
                position: sticky;
                border-bottom: var(--border);
                background-color: var(--color-pageBackground);
            }
			.css-w4guu2 {
				padding-top: 1.5rem;
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
