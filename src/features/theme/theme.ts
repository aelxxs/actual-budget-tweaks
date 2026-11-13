import { defineSetting } from "@features/types";
import { RETIRED_THEMES } from "@lib/design";
import { getValue, setValue } from "@lib/store";
import { DEFAULT_THEME } from "./defaults";
import { applyThemeByKey, watchWindowColor } from "./theme-apply";
import ThemeCustomizer from "./ThemeCustomizer.svelte";
import { loadUserThemes } from "./user-themes.svelte";

/** Moves saved choices of a merged built-in theme onto the theme it merged into. */
async function migrateRetiredThemes() {
	for (const key of ["catppuccin-palette", "theme-auto-dark", "theme-auto-light"]) {
		const saved = await getValue<string | null>(key, null);
		if (saved && RETIRED_THEMES[saved]) {
			await setValue(key, RETIRED_THEMES[saved]);
		}
	}
}

/** The chosen theme, or with auto-switch on, the one picked for the system's light or dark mode. */
export async function applyCurrentTheme(fallback: string) {
	let key: string;
	if (await getValue<boolean>("theme-auto-switch", false)) {
		key = window.matchMedia("(prefers-color-scheme: dark)").matches
			? await getValue<string>("theme-auto-dark", DEFAULT_THEME)
			: await getValue<string>("theme-auto-light", "latte");
	} else {
		key = await getValue<string>(themeSelector.context.key, fallback);
	}
	await applyThemeByKey(key, fallback);
}

export const themeSelector = defineSetting({
	type: "custom",
	label: "",
	platform: "all",
	context: {
		key: "catppuccin-palette",
		defaultValue: DEFAULT_THEME,
	},
	component: ThemeCustomizer,
	syncs: ["theme-auto-switch", "theme-auto-dark", "theme-auto-light", "user-themes"],
	init: async (ctx) => {
		// Always on, like this setting, so it never stops.
		watchWindowColor();
		await migrateRetiredThemes();
		await loadUserThemes();
		await applyCurrentTheme(ctx.defaultValue as string);
		window
			.matchMedia("(prefers-color-scheme: dark)")
			.addEventListener("change", () => void applyCurrentTheme(ctx.defaultValue as string));
	},
	apply: async (_value, ctx) => {
		await loadUserThemes();
		await applyCurrentTheme(ctx.defaultValue as string);
	},
});
