import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue } from "@lib/utilities/store";
import SpacingPicker from "./Picker.svelte";

// The live sidebar uses px padding, so native rem values don't translate 1:1.
const LIVE_ROW_PAD: Record<string, string> = {
	".05rem": "4px",
	".15rem": "5px",
	".25rem": "6px",
};

export const sidebarAccountSpacing = defineSetting({
	type: "custom",
	label: "Sidebar Density",
	description: "Adjust the spacing of accounts, nav links, and search in the sidebar.",
	group: "Sidebar",
	context: {
		key: "actual-sidebar-account-spacing",
		defaultValue: ".15rem",
		css: (value: string) => `
	        :root {
	            --sb-row-pad-y: ${LIVE_ROW_PAD[value] ?? "5px"};
	        }

	        /* sidebar -- section title */
	        .css-hfi7l9 {
	            border-bottom: 2.5px solid var(--ctp-blue, var(--color-pageTextLink));
	            padding-bottom: ${value};
	        }

	        /* sidebar -- acct title */
	        .css-15e1mkk {
	            padding-block: ${value};
	        }

	        /* sidebar -- small link */
	        .css-13d5vlg,
	        .css-e5dykp {
	            padding-block: calc(${value} + .4rem);
	        }
		`,
	},
	component: SpacingPicker,
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		applyGlobalCSS(ctx.css(value as string), ctx.key);
	},
});
