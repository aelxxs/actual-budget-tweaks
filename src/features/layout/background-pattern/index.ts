import { defineSetting } from "@features/types";
import { BG_PATTERN_SELECTORS, bgPatterns } from "./data";
import BackgroundPatternPicker from "./Picker.svelte";

export const backgroundPattern = defineSetting({
	type: "select",
	label: "Background pattern",
	description: "Adds a pattern behind the page.",
	group: "General",
	icon: "layout",
	context: {
		key: "background-pattern",
		defaultValue: "None",
	},
	options: Object.keys(bgPatterns).map((name) => ({ value: name, label: name })),
	picker: BackgroundPatternPicker,
	css: ({ value }) => `
		${BG_PATTERN_SELECTORS} {
			${bgPatterns[value as string]}
		}
	`,
});
