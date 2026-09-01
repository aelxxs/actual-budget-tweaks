import { defineSetting } from "@features/types";
import { getValue as getVal, getValue } from "@lib/utilities/store";
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
		const activeTheme = (await getVal<string>("catppuccin-palette", "mocha")) as string;
		const stored = await getValue<ThemeOverrides | Record<string, string> | null>(ctx.key, null);
		if (!stored) return;

		// Detect and handle old flat format (keys start with "--color-")
		const firstKey = Object.keys(stored)[0];

		// Populate shared state for every theme, not just the active one, so switching
		// themes in-session still re-applies that theme's saved overrides
		const normalized: ThemeOverrides = firstKey?.startsWith("--")
			? { [activeTheme]: stored as Record<string, string> }
			: (stored as ThemeOverrides);
		editorState.overrides = normalized;
		editorState.activeTheme = activeTheme;
		applyOverrides(activeTheme);
	},
});
