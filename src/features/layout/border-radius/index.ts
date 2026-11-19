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
		{ value: "0.75rem", label: "Rounder" },
		{ value: "1rem", label: "Large" },
		{ value: "1.5rem", label: "Pill" },
	],
	picker: BorderRadiusPicker,
	css: ({ value }) => `:root { --border-radius: ${value}; }`,
});
