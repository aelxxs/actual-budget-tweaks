import { getTheme, themeSelectOptions } from "../design";
import { getValue, setValue } from "../utilities/store";
import { SelectSetting } from "./types";

function applyPalette(name: string) {
	const palette = getTheme(name);
	if (palette) {
		const root = document.querySelector<HTMLElement>(":root");
		if (!root) return;
		for (const [varName, val] of Object.entries(palette.keys)) {
			root.style.setProperty(varName, val);
		}
	}
}

export const themeSelector: SelectSetting = {
	type: "select",
	label: "Theme",
	options: themeSelectOptions,
	context: {
		key: "catppuccin-palette",
		defaultValue: "mocha",
	},
	init: async (ctx) => {
		const saved = await getValue(ctx.key, ctx.defaultValue);
		applyPalette(saved);
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		applyPalette(value);
	},
};
