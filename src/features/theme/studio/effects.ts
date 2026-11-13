import { MAIN, PAGE_COLUMN, REPORTS_PAGE } from "@lib/actual-dom";
import { desktopOnly } from "@lib/utilities/pages";
import {
	type Effects,
	type Generated,
	generate,
	glowLayers,
	grainImage,
	type Mode,
	type Recipe,
} from "./generator";

export const STUDIO_STYLE_ID = "theme-studio";

/*
 * Every shell surface paints the same viewport-fixed background, so the effects line up across
 * them as one surface. Nothing goes transparent, so content can't show through while it scrolls.
 */
export const SURFACES = `
	[data-abt-content-grid],
	[data-abt-header],
	${PAGE_COLUMN},
	.abt-side-drawer-header,
	.abt-side-drawer-body,
	.abt-side-drawer-body .abt-tabs,
	[data-abt-tweaks-host],
	[data-abt-tweaks-host] .settings-page,
	.settings-toolbar,
	/* Not the calendar's grid: it slides on a transform, which unfixes a fixed background. */
	${MAIN}:not([data-abt-overlay-page] *),
	${REPORTS_PAGE},
	${REPORTS_PAGE} > div:not([data-abt-overlay-page]),
	${REPORTS_PAGE} > div:not([data-abt-overlay-page]) > div:first-of-type
`;

/** The accent and second colors of a theme without a generated palette, as its CSS has them. */
export const CSS_COLORS = { mauve: "var(--abt-accent)", sapphire: "var(--color-pageTextLink)" };

/** The palette as the theme loader takes it: `--ctp-<name>` to hex. */
export function paletteKeys(g: Generated): Record<string, string> {
	return Object.fromEntries(Object.entries(g.colors).map(([k, hex]) => [`--ctp-${k}`, hex]));
}

/** What a recipe adds beyond its palette: the sidebar's own colors, glow and grain. */
export function studioCSS(r: Recipe, g: Generated = generate(r)): string {
	return sidebarCSS(r, g) + bordersCSS(r, g) + desktopOnly(effectsCSS(r, r.mode, g.colors));
}

/** Raised borders reach ABT's own panels and cards too, which otherwise draw a faint ink tint. */
function bordersCSS(r: Recipe, g: Generated): string {
	if (!r.borders) {
		return "";
	}
	return `
		:root:root {
			--abt-line: ${g.colors.line};
			--abt-panel-border: var(--abt-line-secondary);
			--color-sidebarBorder: var(--abt-line-secondary);
		}
		.sidebar.sidebar {
			--sb-line: var(--abt-line-secondary);
		}`;
}

/** Glow and grain on a theme that isn't a Studio one. */
export function themeEffectsCSS(effects: Effects, mode: Mode): string {
	return desktopOnly(effectsCSS(effects, mode, CSS_COLORS));
}

function sidebarCSS(r: Recipe, g: Generated): string {
	if (r.sidebar === "match") {
		return "";
	}
	const s = g.sidebar;
	// Only the sidebar's own tokens: --color-sidebarItemAccentSelected is ABT's accent everywhere.
	return `
		/* Doubled, to outrank the palette's own :root rule whichever style tag comes later. */
		:root:root {
			--color-sidebarBackground: ${s.bg};
			--color-sidebarBorder: ${r.borders ? "var(--abt-line-secondary)" : s.hover};
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

/** Paints glow and grain across every shell surface, as one fixed background. */
function effectsCSS(e: Effects, mode: Mode, colors: Record<string, string>): string {
	const layers = glowLayers({ mode, glow: e.glow }, colors, "100vw", "100vh");
	const images = [
		...(e.grain.amount > 0 ? [grainImage(e.grain.amount, e.grain.size)] : []),
		...layers,
	];
	if (!images.length) {
		return "";
	}
	const blend = images.map((_, i) => (i === 0 && e.grain.amount > 0 ? "overlay" : "normal"));
	const sizes = images.map((_, i) => (i === 0 && e.grain.amount > 0 ? "220px 220px" : "100% 100%"));
	const repeat = images.map((_, i) => (i === 0 && e.grain.amount > 0 ? "repeat" : "no-repeat"));
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
