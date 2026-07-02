import { defineSetting } from "@features/types";
import { getValue } from "@lib/utilities/store";
import BorderRadiusPicker from "./Picker.svelte";

export const borderRadius = defineSetting({
	type: "custom",
	label: "Border Radius",
	description: "Corner roundness for cards and buttons app-wide.",
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
});
