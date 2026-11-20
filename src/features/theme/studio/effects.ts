import { MAIN, PAGE_COLUMN, REPORTS_PAGE } from "@lib/actual-dom";
import { desktopOnly } from "@lib/actual/pages";
import type { PaletteTheme } from "@lib/design/types";
import { FLOATING_ATTR } from "@features/layout/inset-panels";
import { LIVE_SIDEBAR_ATTR } from "@features/workflows/sidebar/lib/collapse";
import {
	type Effects,
	type Generated,
	generate,
	glowLayers,
	grainImage,
	type Mode,
	type Recipe,
	sidebarLine,
} from "./generator";

export const STUDIO_STYLE_ID = "theme-studio";

/*
 * Every shell surface paints the same viewport-fixed background, so the effects line up across
 * them as one surface. Nothing goes transparent, so content can't show through while it scrolls.
 */
const SURFACES = `
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
const CSS_COLORS = { mauve: "var(--abt-accent)", sapphire: "var(--color-pageTextLink)" };

/** The palette as the theme loader takes it: `--ctp-<name>` to hex. */
export function paletteKeys(g: Generated): Record<string, string> {
	return Object.fromEntries(Object.entries(g.colors).map(([k, hex]) => [`--ctp-${k}`, hex]));
}

/** A recipe as the palette theme it makes, painted like any built-in one. */
export function themeFromRecipe(r: Recipe, g: Generated = generate(r)): PaletteTheme {
	const { line, ...colors } = g.colors;
	const keys = paletteKeys({ ...g, colors });
	if (r.borders) {
		keys["--theme-line"] = line;
	}
	if (r.sidebar !== "match") {
		for (const [name, hex] of Object.entries(g.sidebar)) {
			keys[name === "bg" ? "--theme-sidebar" : `--theme-sidebar-${name}`] = hex;
		}
		const line = sidebarLine(r, g.sidebar);
		if (line) {
			keys["--theme-sidebar-line"] = line;
		}
	}
	g.chart.forEach((hex, i) => (keys[`--theme-chart-${i + 1}`] = hex));
	keys["--theme-data"] = g.data;
	return { mode: r.mode, keys };
}

/** A recipe's glow and grain. */
export function studioCSS(r: Recipe, g: Generated = generate(r)): string {
	return desktopOnly(effectsCSS(r, r.mode, g.colors));
}

/** Glow and grain on a theme that isn't a Studio one. */
export function themeEffectsCSS(effects: Effects, mode: Mode): string {
	return desktopOnly(effectsCSS(effects, mode, CSS_COLORS));
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
		/* Under a transparent border too (the floating sidebar's), or it shows as a ring without them. */
		background-origin: border-box !important;
	`;
	return `
		${SURFACES} { ${paint("var(--color-pageBackground)")} }
		.sidebar,
		:root[${FLOATING_ATTR}][${LIVE_SIDEBAR_ATTR}] [data-abt-shell] { ${paint("var(--color-sidebarBackground)")} }
		.sidebar .activity-bar { background-color: color-mix(in srgb, black 10%, transparent) !important; }
	`;
}
