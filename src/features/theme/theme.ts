import { defineSetting } from "@features/types";
import { RETIRED_THEMES } from "@lib/design";
import { getValue, setValue } from "@lib/utilities/store";
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

export const themeSelector = defineSetting({
	type: "custom",
	label: "",
	platform: "all",
	context: {
		key: "catppuccin-palette",
		defaultValue: DEFAULT_THEME,
	},
	component: ThemeCustomizer,
	init: async (ctx) => {
		// Always on, like this setting, so it never stops.
		watchWindowColor();
		await migrateRetiredThemes();
		await loadUserThemes();

		const autoSwitch = await getValue<boolean>("theme-auto-switch", false);
		if (autoSwitch) {
			const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			const darkKey = (await getValue<string>("theme-auto-dark", DEFAULT_THEME)) as string;
			const lightKey = (await getValue<string>("theme-auto-light", "latte")) as string;
			const key = isDark ? darkKey : lightKey;
			await applyThemeByKey(key, ctx.defaultValue as string);

			window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async (e) => {
				const k = e.matches
					? ((await getValue<string>("theme-auto-dark", DEFAULT_THEME)) as string)
					: ((await getValue<string>("theme-auto-light", "latte")) as string);
				await applyThemeByKey(k, ctx.defaultValue as string);
			});
			return;
		}

		const saved = (await getValue(ctx.key, ctx.defaultValue)) as string;
		await applyThemeByKey(saved, ctx.defaultValue as string);
	},
});
