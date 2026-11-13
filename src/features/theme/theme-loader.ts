import { defineSetting } from "@features/types";
import { RETIRED_THEMES } from "@lib/design";
import { getValue as getVal, getValue, setValue } from "@lib/store";
import { DEFAULT_THEME } from "./defaults";
import { editorState, type ThemeOverrides } from "./editor-state.svelte";
import { applyOverrides } from "./theme-apply";
import { applyCurrentTheme } from "./theme";

/** Reads the saved token overrides into the editor's state; returns the active theme. */
async function loadOverrides(key: string): Promise<string> {
	const saved = (await getVal<string>("catppuccin-palette", DEFAULT_THEME)) as string;
	const activeTheme = RETIRED_THEMES[saved] ?? saved;
	const stored = await getValue<ThemeOverrides | Record<string, string> | null>(key, null);
	editorState.activeTheme = activeTheme;
	if (!stored) {
		editorState.overrides = {};
		return activeTheme;
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
		await setValue(key, normalized);
	}
	editorState.overrides = normalized;
	return activeTheme;
}

export const themeLoader = defineSetting({
	type: "custom",
	label: "Theme Loader",
	context: {
		key: "custom-theme",
		defaultValue: null,
	},
	init: async (ctx) => {
		const active = await loadOverrides(ctx.key);
		if (Object.keys(editorState.overrides).length) {
			applyOverrides(active);
		}
	},
	// The whole theme goes back on, so overrides removed on another device clear too.
	apply: async (_value, ctx) => {
		await loadOverrides(ctx.key);
		await applyCurrentTheme(DEFAULT_THEME);
	},
});
