import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue } from "@lib/utilities/store";
import SpacingPicker from "./Picker.svelte";

export const sidebarAccountSpacing = defineSetting({
	type: "custom",
	label: "Sidebar Account Spacing",
	description: "Adjust the spacing between accounts in the sidebar.",
	group: "Sidebar",
	context: {
		key: "actual-sidebar-account-spacing",
		defaultValue: ".15rem",
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
	},
	component: SpacingPicker,
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		applyGlobalCSS(ctx.css(value as string), ctx.key);
	},
});
