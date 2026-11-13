import { defineSetting } from "@features/types";
import { RETIRED_THEMES } from "@lib/design";
import { getValue as getVal, getValue, setValue } from "@lib/store";
import { DEFAULT_THEME } from "./defaults";
import { editorState, type ThemeOverrides } from "./editor-state.svelte";
import { applyOverrides } from "./theme-apply";

export const themeLoader = defineSetting({
	type: "custom",
	label: "Theme Loader",
	context: {
		key: "custom-theme",
		defaultValue: null,
	},
	init: async (ctx) => {
		const saved = (await getVal<string>("catppuccin-palette", DEFAULT_THEME)) as string;
		const activeTheme = RETIRED_THEMES[saved] ?? saved;
		const stored = await getValue<ThemeOverrides | Record<string, string> | null>(ctx.key, null);
		if (!stored) {
			return;
		}

		// Detect and handle old flat format (keys start with "--color-")
		const firstKey = Object.keys(stored)[0];

		// Populate shared state for every theme, not just the active one, so switching
		// themes in-session still re-applies that theme's saved overrides
		const normalized: ThemeOverrides = firstKey?.startsWith("--")
			? { [activeTheme]: stored as Record<string, string> }
			: (stored as ThemeOverrides);
		let moved = false;
		for (const [from, to] of Object.entries(RETIRED_THEMES)) {
			if (normalized[from]) {
				normalized[to] ??= normalized[from];
				delete normalized[from];
				moved = true;
			}
		}
		if (moved) {
			await setValue(ctx.key, normalized);
		}
		editorState.overrides = normalized;
		editorState.activeTheme = activeTheme;
		applyOverrides(activeTheme);
	},
});
