import { defineSetting } from "@features/types";
import { getValue } from "@lib/store";
import BorderRadiusPicker from "./Picker.svelte";

export const borderRadius = defineSetting({
	type: "custom",
	label: "Rounded corners",
	description: "Sets how round cards and buttons are.",
	group: "General",
	context: {
		key: "border-radius",
		defaultValue: "0.5rem",
	},
	component: BorderRadiusPicker,
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		document.documentElement.style.setProperty("--border-radius", value as string);
	},
	apply: (value) => document.documentElement.style.setProperty("--border-radius", value as string),
});
