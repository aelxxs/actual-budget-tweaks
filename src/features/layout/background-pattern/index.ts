import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/dom/dom";
import { desktopOnly } from "@lib/actual/pages";
import { getValue } from "@lib/store";
import { BG_PATTERN_SELECTORS, bgPatterns } from "./data";
import BackgroundPatternPicker from "./Picker.svelte";

export const backgroundPattern = defineSetting({
	type: "custom",
	label: "Background pattern",
	description: "Adds a pattern behind the page.",
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
