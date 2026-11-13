import { applyGlobalCSS } from "@lib/dom/dom";
import { getValue } from "@lib/store";
import { DEFAULT_THEME } from "../defaults";
import { applyThemeByKey, applyUserPaletteTheme } from "../theme-apply";
import { paletteKeys, STUDIO_STYLE_ID, studioCSS } from "./effects";
import type { Generated, Recipe } from "./generator";

const PREVIEW_ID = "studio:preview";

/** Paints a recipe on the page: palette, sidebar, glow and grain. */
export function previewRecipe(r: Recipe, g: Generated): void {
	applyUserPaletteTheme(PREVIEW_ID, paletteKeys(g));
	applyGlobalCSS(studioCSS(r, g), STUDIO_STYLE_ID);
}

/** Puts the saved theme back, as the theme setting's init chooses it. */
export async function restoreSavedTheme(): Promise<void> {
	applyGlobalCSS("", STUDIO_STYLE_ID);
	let key = (await getValue<string>("catppuccin-palette", DEFAULT_THEME)) ?? DEFAULT_THEME;
	if (await getValue<boolean>("theme-auto-switch", false)) {
		const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		key =
			(dark
				? await getValue<string>("theme-auto-dark", DEFAULT_THEME)
				: await getValue<string>("theme-auto-light", "latte")) ?? DEFAULT_THEME;
	}
	await applyThemeByKey(key, DEFAULT_THEME);
}
