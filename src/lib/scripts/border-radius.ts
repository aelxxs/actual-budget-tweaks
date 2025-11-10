import { getValue, setValue } from "../utilities/store";
import { SelectSetting } from "./types";

export const borderRadius: SelectSetting = {
	type: "select",
	label: "Border Radius",
	options: [
		{ value: "0.25rem", label: "Small (0.25rem)" },
		{ value: "0.5rem", label: "Medium (0.5rem)" },
		{ value: "0.75rem", label: "Medium Again (0.75rem)" },
		{ value: "1rem", label: "Large (1rem)" },
		{ value: "1.5rem", label: "Extra Large (1.5rem)" },
		{ value: "0rem", label: "None (0rem)" },
	],
	context: {
		key: "border-radius",
		defaultValue: "0.5rem",
	},
	init: async (ctx) => {
		const value = await getValue(ctx.key, ctx.defaultValue);
		document.documentElement.style.setProperty("--border-radius", value);
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		document.documentElement.style.setProperty("--border-radius", value);
	},
};
