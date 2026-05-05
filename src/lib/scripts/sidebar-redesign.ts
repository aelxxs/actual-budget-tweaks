import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const sidebarRedesign = defineSetting({
	type: "checkbox",
	label: "Improved Sidebar Design",
	context: {
		key: "improved-sidebar-design",
		defaultValue: true,
		css: () => `
            /* sidebar -- budget container */
            .css-1q5hn2l {
                border-bottom: var(--border);
                border-color: var(--color-sidebarItemBackgroundHover);
                padding-block: 1rem;
                padding-inline: 1.5rem;
                margin: 0px;
                height: 3.25rem;
                margin-bottom: 0.75rem;
                flex-shrink: 0;
            }
            /* sidebar -- add account container */
            .css-37q6ds {
                flex-shrink: 0;
                padding: 0px;
                border-top: var(--border);
                border-color: var(--color-sidebarItemBackgroundHover);
            }
            .css-37q6ds button {
                margin-bottom: 0px !important;
                padding-block: 0.75rem !important;
                border-radius: 0px;
            }
        `,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled && ctx.css) {
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
