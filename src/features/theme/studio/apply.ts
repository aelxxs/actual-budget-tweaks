import { SURFACES } from "@features/appearance/ambient";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue } from "@lib/utilities/store";
import { DEFAULT_THEME } from "../defaults";
import { applyThemeByKey, applyUserPaletteTheme } from "../theme-apply";
import { type Generated, glowLayers, grainImage, type Recipe } from "./generator";

const STYLE_ID = "theme-studio";
const PREVIEW_ID = "studio:preview";

/** Paints a recipe on the page: palette, sidebar, glow and grain. */
export function previewRecipe(r: Recipe, g: Generated): void {
	const keys: Record<string, string> = {};
	for (const [name, hex] of Object.entries(g.colours)) {
		keys[`--ctp-${name}`] = hex;
	}
	applyUserPaletteTheme(PREVIEW_ID, keys);
	applyGlobalCSS(sidebarCSS(r, g) + effectsCSS(r, g), STYLE_ID);
}

/** Puts the saved theme back, as the theme setting's init chooses it. */
export async function restoreSavedTheme(): Promise<void> {
	applyGlobalCSS("", STYLE_ID);
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

function sidebarCSS(r: Recipe, g: Generated): string {
	if (r.sidebar === "match") {
		return "";
	}
	const s = g.sidebar;
	// Only the sidebar's own tokens: --color-sidebarItemAccentSelected is ABT's accent everywhere.
	return `
		:root {
			--color-sidebarBackground: ${s.bg};
			--color-sidebarBorder: ${s.hover};
			--color-sidebarBudgetName: ${s.text};
			--color-sidebarHeaderText: ${s.text};
			--color-sidebarItemText: ${s.text};
			--color-sidebarItemTextSelected: ${s.sel};
			--color-sidebarItemBackgroundHover: ${s.hover};
			--color-sidebarItemBackgroundSelected: color-mix(in srgb, ${s.sel} 18%, transparent);
			--color-sidebarControlBackground: ${s.hover};
			--color-sidebarTextSubdued: ${s.sub};
			--color-sidebarTextMuted: ${s.sub};
			--color-sidebarTextFailed: ${s.neg};
		}
		/* Page colours that ABT's sidebar tiles use, remade for this background. */
		.sidebar {
			--abt-accent: ${s.sel};
			--color-sidebarItemAccentSelected: ${s.sel};
			--color-pageText: ${s.text};
			--color-pageTextSubdued: ${s.sub};
			--color-sidebarTextPositive: ${s.pos};
			--color-noticeTextLight: ${s.pos};
			--color-errorText: ${s.neg};
			--color-sidebarItemBackgroundFailed: ${s.neg};
			--color-sidebarItemBackgroundPositive: ${s.pos};
			--color-sidebarItemBackgroundPending: ${s.warn};
			--color-warningText: ${s.warn};
			--color-tableBorder: ${s.hover};
		}
	`;
}

/*
 * Ambient Glow's painting, with this recipe's lights and grain in place of the fixed ones. Painted
 * even with neither, so the Ambient settings' own layers don't show through the preview.
 */
function effectsCSS(r: Recipe, g: Generated): string {
	const layers = glowLayers(r, g.colours, "100vw", "100vh");
	const images = [
		...(r.grain.amount > 0 ? [grainImage(r.grain.amount, r.grain.size)] : []),
		...layers,
	];
	if (!images.length) {
		return `
			${SURFACES} { background: var(--color-pageBackground) !important; }
			.sidebar { background: var(--color-sidebarBackground) !important; }
		`;
	}
	const blend = images.map((_, i) => (i === 0 && r.grain.amount > 0 ? "overlay" : "normal"));
	const sizes = images.map((_, i) => (i === 0 && r.grain.amount > 0 ? "220px 220px" : "100% 100%"));
	const repeat = images.map((_, i) => (i === 0 && r.grain.amount > 0 ? "repeat" : "no-repeat"));
	const paint = (base: string) => `
		background: ${images.join(", ")}, ${base} !important;
		background-size: ${sizes.join(", ")} !important;
		background-repeat: ${repeat.join(", ")} !important;
		background-attachment: fixed !important;
		background-blend-mode: ${blend.join(", ")} !important;
	`;
	return `
		${SURFACES} { ${paint("var(--color-pageBackground)")} }
		.sidebar { ${paint("var(--color-sidebarBackground)")} }
		.sidebar .activity-bar { background-color: color-mix(in srgb, black 10%, transparent) !important; }
	`;
}
