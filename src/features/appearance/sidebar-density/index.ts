import { defineSetting } from "@features/types";
import DensityPicker from "./Picker.svelte";

// Stored as the rem values the old native-sidebar version used, so saved choices carry over.
const ROW_PAD: Record<string, string> = {
	".05rem": "4px",
	".15rem": "5px",
	".25rem": "6px",
};

export const sidebarDensity = defineSetting({
	type: "select",
	label: "Sidebar density",
	description: "Sets the spacing in the live sidebar.",
	group: "Sidebar",
	icon: "unfoldVertical",
	context: {
		key: "actual-sidebar-account-spacing",
		defaultValue: ".15rem",
	},
	options: [
		{ value: ".05rem", label: "Slim" },
		{ value: ".15rem", label: "Normal" },
		{ value: ".25rem", label: "Relaxed" },
	],
	picker: DensityPicker,
	css: ({ value }) => `:root { --sb-row-pad-y: ${ROW_PAD[value as string] ?? "5px"}; }`,
});
