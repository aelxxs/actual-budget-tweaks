import { defineSetting } from "@features/types";
import BorderRadiusPicker from "./Picker.svelte";

export const borderRadius = defineSetting({
	type: "select",
	label: "Rounded corners",
	description: "Sets how round cards and buttons are.",
	group: "General",
	icon: "squareRoundCorner",
	platform: "all",
	context: {
		key: "border-radius",
		defaultValue: "0.5rem",
	},
	options: [
		{ value: "0rem", label: "None" },
		{ value: "0.25rem", label: "Small" },
		{ value: "0.5rem", label: "Medium" },
		{ value: "0.75rem", label: "Large" },
	],
	picker: BorderRadiusPicker,
	// Capped at the top step: the removed 1rem and 1.5rem steps may still be saved, and past it
	// only Actual's panels rounded further, as ABT's radius tokens stop there.
	css: ({ value }) => `:root { --border-radius: min(${value}, 0.75rem); }`,
});
