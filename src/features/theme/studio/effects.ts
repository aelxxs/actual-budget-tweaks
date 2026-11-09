import { SURFACES } from "@features/appearance/ambient";
import { desktopOnly } from "@lib/utilities/pages";
import { type Generated, generate, glowLayers, grainImage, type Recipe } from "./generator";

export const STUDIO_STYLE_ID = "theme-studio";

/** The palette as the theme loader takes it: `--ctp-<name>` to hex. */
export function paletteKeys(g: Generated): Record<string, string> {
	return Object.fromEntries(Object.entries(g.colors).map(([k, hex]) => [`--ctp-${k}`, hex]));
}

/**
 * What a recipe adds beyond its palette: the sidebar's own colors, glow and grain. The preview
 * paints the surfaces even with no glow or grain, so the Ambient settings' layers don't show
 * through it; a saved theme without either leaves them to those settings.
 */
export function studioCSS(r: Recipe, g: Generated = generate(r), preview = false): string {
	return sidebarCSS(r, g) + desktopOnly(effectsCSS(r, g, preview));
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
		/* Page colors that ABT's sidebar tiles use, remade for this background. */
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

/** Ambient Glow's painting, with this recipe's lights and grain in place of the fixed ones. */
function effectsCSS(r: Recipe, g: Generated, preview: boolean): string {
	const layers = glowLayers(r, g.colors, "100vw", "100vh");
	const images = [
		...(r.grain.amount > 0 ? [grainImage(r.grain.amount, r.grain.size)] : []),
		...layers,
	];
	if (!images.length) {
		if (!preview) {
			return "";
		}
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
