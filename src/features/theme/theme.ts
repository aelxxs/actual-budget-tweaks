import { defineSetting } from "@features/types";
import { getValue } from "@lib/utilities/store";
import { applyCommunityTheme, applyPalette, isCommunityTheme } from "./theme-apply";
import ThemeCustomizer from "./ThemeCustomizer.svelte";

export const themeSelector = defineSetting({
	type: "custom",
	label: "",
	context: {
		key: "catppuccin-palette",
		defaultValue: "mocha",
	},
	component: ThemeCustomizer,
	init: async (ctx) => {
		const saved = (await getValue(ctx.key, ctx.defaultValue)) as string;
		if (isCommunityTheme(saved)) {
			try {
				await applyCommunityTheme(saved);
			} catch {
				applyPalette(ctx.defaultValue as string);
			}
		} else {
			applyPalette(saved);
		}
	},
});
