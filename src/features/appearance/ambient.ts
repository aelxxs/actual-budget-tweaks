import { defineSetting } from "@features/types";
import { MAIN, PAGE_COLUMN, REPORTS_PAGE } from "@lib/actual-dom";
import { desktopOnly } from "@lib/utilities/pages";

// Opaque noise centred on mid-grey: overlaid, it lightens and darkens equally, so the average
// brightness stays put on any theme. Its contrast (the 0.6 and 0.2 below) sets the strength.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n' color-interpolation-filters='sRGB'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='.6 0 0 0 .2 .6 0 0 0 .2 .6 0 0 0 .2 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const accent = (strength: number) =>
	`color-mix(in srgb, var(--abt-accent) ${strength}%, transparent)`;

const GLOW = `radial-gradient(55% 65% at 0% 0%, ${accent(16)}, transparent), radial-gradient(40% 45% at 100% 100%, ${accent(6)}, transparent)`;

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
	[data-abt-calendar] .cal-day-name,
	${MAIN},
	${REPORTS_PAGE},
	${REPORTS_PAGE} > div:not([data-abt-calendar]),
	${REPORTS_PAGE} > div:not([data-abt-calendar]) > div:first-of-type
`;

const paint = (base: string) => `
	background: var(--abt-ambient-grain, none), var(--abt-ambient-glow, none, none), ${base} !important;
	background-attachment: fixed !important;
	background-blend-mode: overlay, normal, normal !important;
`;

// Each toggle sets its own layer; either one on is enough for the shared rules below.
const SHELL = `
	${SURFACES} { ${paint("var(--color-pageBackground)")} }
	/* Some light themes keep a dark sidebar with light text, so it keeps its own base colour. */
	.sidebar { ${paint("var(--color-sidebarBackground)")} }
	/* The rail stays darker than the panel beside it, but lets the effects through. */
	.sidebar .activity-bar { background-color: color-mix(in srgb, black 10%, transparent) !important; }
`;

export const ambientGlow = defineSetting({
	type: "checkbox",
	label: "Ambient Glow",
	description: "A soft glow of the theme's accent across the sidebar, header, page and side panel.",
	group: "General",
	icon: "sparkles",
	platform: "desktop",
	context: {
		key: "ambient-glow",
		defaultValue: false,
	},
	css: () => desktopOnly(`:root { --abt-ambient-glow: ${GLOW}; } ${SHELL}`),
});

export const ambientGrain = defineSetting({
	type: "checkbox",
	label: "Ambient Grain",
	description: "A fine grain across the sidebar, header, page and side panel.",
	group: "General",
	icon: "image",
	platform: "desktop",
	context: {
		key: "ambient-grain",
		defaultValue: false,
	},
	css: () => desktopOnly(`:root { --abt-ambient-grain: ${GRAIN}; } ${SHELL}`),
});
