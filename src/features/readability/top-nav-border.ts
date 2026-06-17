import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

export const headerBorder = defineSetting({
	type: "checkbox",
	label: "Header Border",
	context: {
		key: "header-border",
		defaultValue: true,
		css: () => `
            .css-pq65pe {
                border-bottom: var(--border);
            }
			.abt-side-drawer-sidebar {
				border-top: none;
				border-top-left-radius: 0px;
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
