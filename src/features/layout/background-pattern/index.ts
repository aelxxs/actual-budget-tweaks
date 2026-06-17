import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue } from "@lib/utilities/store";
import { BG_PATTERN_SELECTORS, bgPatterns } from "./data";
import BackgroundPatternPicker from "./Picker.svelte";

export const backgroundPattern = defineSetting({
	type: "custom",
	label: "Background Pattern",
	context: {
		key: "background-pattern",
		defaultValue: "None",
		css: (value: string) => `
			${BG_PATTERN_SELECTORS} {
				${bgPatterns[value]}
			}
		`,
	},
	component: BackgroundPatternPicker,
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		applyGlobalCSS(ctx.css(value as string), ctx.key);
	},
});
