import { defineSetting } from "@features/types";
import { getValue as getVal, getValue } from "@lib/utilities/store";
import { editorState, type ThemeOverrides } from "./editor-state.svelte";

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
		const overrides: Record<string, string> = firstKey?.startsWith("--")
			? (stored as Record<string, string>)
			: ((stored as ThemeOverrides)[activeTheme] ?? {});

		if (Object.keys(overrides).length === 0) return;

		const root = document.querySelector<HTMLElement>(":root");
		if (!root) return;
		for (const [key, val] of Object.entries(overrides)) {
			root.style.setProperty(key, val);
		}

		// Populate shared state so ThemeCustomizer can show indicators immediately
		const normalized: ThemeOverrides = firstKey?.startsWith("--")
			? { [activeTheme]: stored as Record<string, string> }
			: (stored as ThemeOverrides);
		editorState.overrides = normalized;
		editorState.activeTheme = activeTheme;
	},
});
