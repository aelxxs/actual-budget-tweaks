import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

export const sidebarAccountSpacing = defineSetting({
	type: "select",
	label: "Sidebar Account Spacing",
	options: [
		{ value: ".05rem", label: "Slim" },
		{ value: ".15rem", label: "Normal (Default)" },
		{ value: ".25rem", label: "Relaxed" },
	],
	context: {
		key: "actual-sidebar-account-spacing",
		css: (value: string) => `
            /* sidebar -- section title */
            .css-hfi7l9 {
                border-bottom: 2.5px solid var(--ctp-blue);
                padding-bottom: ${value};
            }

            /* sidebar -- acct title */
            .css-15e1mkk {
                padding-block: ${value};
            }

            /* sidebar -- small link */
            .css-13d5vlg,
            .css-e5dykp {
                padding-block: .55rem;
            }
		`,
		defaultValue: ".15rem",
	},
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		if (ctx.css) {
			applyGlobalCSS(ctx.css(value), ctx.key);
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (ctx.css) {
			applyGlobalCSS(ctx.css(value), ctx.key);
		}
	},
});
