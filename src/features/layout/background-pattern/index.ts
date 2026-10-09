import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { desktopOnly } from "@lib/utilities/pages";
import { getValue } from "@lib/utilities/store";
import { BG_PATTERN_SELECTORS, bgPatterns } from "./data";
import BackgroundPatternPicker from "./Picker.svelte";

export const backgroundPattern = defineSetting({
	type: "custom",
	label: "Background Pattern",
	description: "A subtle pattern behind the app background.",
	group: "General",
	context: {
		key: "background-pattern",
		defaultValue: "None",
		css: (value: string) =>
			desktopOnly(`
			${BG_PATTERN_SELECTORS} {
				${bgPatterns[value]}
			}
		`),
	},
	component: BackgroundPatternPicker,
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		applyGlobalCSS(ctx.css(value as string), ctx.key);
	},
});
