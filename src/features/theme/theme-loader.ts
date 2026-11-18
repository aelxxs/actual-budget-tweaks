import { defineSetting } from "@features/types";
import { RETIRED_THEMES } from "@lib/design";
import { getValue } from "@lib/store";
import { DEFAULT_THEME } from "./defaults";
import { CSS_OVERRIDES_KEY, editorState } from "./editor-state.svelte";
import { applyOverrides } from "./theme-apply";
import { applyCurrentTheme } from "./theme";

/** Reads every theme's CSS override into the shared state; returns the active theme. */
async function loadOverrides(key: string): Promise<string> {
	const saved = await getValue<string>("catppuccin-palette", DEFAULT_THEME);
	editorState.activeTheme = RETIRED_THEMES[saved] ?? saved;
	editorState.cssOverrides = (await getValue<Record<string, string> | null>(key, null)) ?? {};
	return editorState.activeTheme;
}

export const themeLoader = defineSetting({
	type: "custom",
	label: "Theme Loader",
	context: {
		key: CSS_OVERRIDES_KEY,
		defaultValue: null,
	},
	init: async (ctx) => {
		const active = await loadOverrides(ctx.key);
		if (editorState.cssOverrides[active]) {
			applyOverrides(active);
		}
	},
	apply: async (_value, ctx) => {
		await loadOverrides(ctx.key);
		await applyCurrentTheme(DEFAULT_THEME);
	},
});
