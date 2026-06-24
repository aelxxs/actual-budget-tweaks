import { defineSetting } from "@features/types";
import { getValue } from "@lib/utilities/store";
import { applyCommunityTheme, applyPalette, applyUserPaletteTheme, applyUserCSSTheme, isCommunityTheme } from "./theme-apply";
import ThemeCustomizer from "./ThemeCustomizer.svelte";
import { isUserTheme, loadUserThemes, userThemeState } from "./user-themes.svelte";

export const themeSelector = defineSetting({
	type: "custom",
	label: "",
	context: {
		key: "catppuccin-palette",
		defaultValue: "mocha",
	},
	component: ThemeCustomizer,
	init: async (ctx) => {
		await loadUserThemes();
		const saved = (await getValue(ctx.key, ctx.defaultValue)) as string;
		if (isUserTheme(saved)) {
			const userTheme = userThemeState.themes[saved];
			if (userTheme) {
				if (userTheme.type === "palette" && userTheme.keys) {
					applyUserPaletteTheme(saved, userTheme.keys);
				} else if (userTheme.type === "css" && userTheme.css) {
					applyUserCSSTheme(saved, userTheme.css);
				}
			} else {
				applyPalette(ctx.defaultValue as string);
			}
		} else if (isCommunityTheme(saved)) {
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
