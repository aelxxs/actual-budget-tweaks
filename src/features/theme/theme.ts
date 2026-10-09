import { defineSetting } from "@features/types";
import { getValue } from "@lib/utilities/store";
import { DEFAULT_THEME } from "./defaults";
import { applyThemeByKey } from "./theme-apply";
import ThemeCustomizer from "./ThemeCustomizer.svelte";
import { loadUserThemes } from "./user-themes.svelte";

export const themeSelector = defineSetting({
	type: "custom",
	label: "",
	mobile: true,
	context: {
		key: "catppuccin-palette",
		defaultValue: DEFAULT_THEME,
	},
	component: ThemeCustomizer,
	init: async (ctx) => {
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
