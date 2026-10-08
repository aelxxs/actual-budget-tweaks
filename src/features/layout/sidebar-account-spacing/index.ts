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

	        /* sidebar -- acct title */
	        a[href^="/accounts"] > div:last-of-type > div:first-of-type {
	            padding-block: ${value};
	        }

	        /* sidebar -- small link */
	        [data-testid="sidebar-primary-buttons"] :is(a[href="/payees"], a[href="/rules"], a[href="/bank-sync"], a[href="/tags"], a[href="/settings"]) {
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
