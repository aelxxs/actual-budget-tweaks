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
            /* sidebar -- budget name */
            .css-1am57kc {
                font-size: 16.5px;
            }
            /* sidebar -- budget container */
            .css-1njw0n7 {
                border-bottom: var(--border);
                padding-block: 1rem;
                padding-inline: 1.5rem;
                margin: 0px;
                height: 3.25rem;
                margin-bottom: 0.75rem;
                flex-shrink: 0;
            }
            /* sidebar -- add account container */
            .css-1wlgp5o {
                flex-shrink: 0;
                padding: 0px;
                border-top: var(--border);
            }
            .css-1uzqvp6 {
                margin: 0px;
                padding-block: 0.75rem;
                padding-inline: 1rem;
            }
        `,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled && ctx.css) applyGlobalCSS(ctx.css(), ctx.key);
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
