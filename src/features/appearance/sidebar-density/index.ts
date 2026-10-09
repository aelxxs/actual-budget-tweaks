import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue } from "@lib/utilities/store";
import DensityPicker from "./Picker.svelte";

// Stored as the rem values the old native-sidebar version used, so saved choices carry over.
const ROW_PAD: Record<string, string> = {
	".05rem": "4px",
	".15rem": "5px",
	".25rem": "6px",
};

export const sidebarDensity = defineSetting({
	type: "custom",
	label: "Sidebar Density",
	description: "Adjust the spacing of accounts, nav links, and search in the live sidebar.",
	group: "Sidebar",
	context: {
		key: "actual-sidebar-account-spacing",
		defaultValue: ".15rem",
		css: (value: string) => `:root { --sb-row-pad-y: ${ROW_PAD[value] ?? "5px"}; }`,
	},
	component: DensityPicker,
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		applyGlobalCSS(ctx.css(value as string), ctx.key);
	},
});
