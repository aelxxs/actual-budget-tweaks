import { syncWindowColor } from "@features/theme/theme-apply";
import { defineSetting } from "@features/types";
import { desktopOnly } from "@lib/actual/pages";
import { setValue } from "@lib/store";
import { LIVE_SIDEBAR_ATTR } from "@features/workflows/sidebar/lib/collapse";
import { THEME_APPLIED_EVENT } from "@lib/theme-events";

// 5.5px between the panels, 6px around them.
const GAP = "calc(var(--abt-space-2) + var(--abt-space-1) * 0.75)";
const EDGE = "calc(var(--abt-space-2) + var(--abt-space-1))";
// Concentric with the window's own corner (its radius less the edge gap), so it doesn't follow the
// radius setting; a radius of 0 still squares it.
const RADIUS = "clamp(0px, calc(var(--border-radius, 0.5rem) * 1000), 10px)"; // raw: window corner
const INNER = `max(0px, ${RADIUS} - 1px)`;
// From inside the sidebar's border to the middle of the gap beside it.
const MID = `(1px + ${GAP} / 2)`;
const CARD = `
	border: 1px solid var(--abt-inset-border);
	border-radius: ${RADIUS};
`;

// Actual paints the title bar and body with mobileViewTheme, so the frame matches the title bar.
const CSS = `
	[data-abt-shell] {
		/* Resolved here: the live sidebar re-derives the ink tints from its own text colour. */
		--abt-inset-border: var(--abt-line);
		gap: ${GAP};
		padding: 0 ${EDGE} ${EDGE};
		box-sizing: border-box;
		background: var(--color-mobileViewTheme) !important;
	}
	/* An installed app's title bar takes the frame's colour, so the panels meet it; a browser tab's
	   toolbar doesn't, so they keep a gap there too. */
	@media (display-mode: browser) {
		[data-abt-shell] {
			padding-top: ${EDGE};
		}
	}
	[data-abt-page-card] {
		${CARD}
	}
	[data-abt-sidebar-root] {
		${CARD}
		overflow: hidden;
	}
	/* The live sidebar rounds itself, since it clips past its edge for the resize grip; stretched
	   to the slot, it ends level with the page panel. */
	[data-abt-sidebar-slot] .sidebar {
		${CARD}
		height: auto;
		align-self: stretch;
	}
	[data-abt-sidebar-slot] .sidebar .activity-bar {
		border-radius: ${INNER} 0 0 ${INNER};
	}
	/* With the accounts panel hidden, the rail is the whole panel: the panel widens by its own
	   border so the rail fits inside it at its usual width, and the rail drops its divider. */
	[data-abt-sidebar-slot] .sidebar.rail-only {
		width: calc(4rem + 2px) !important; /* raw: the rail's width plus the panel's border */
	}
	[data-abt-sidebar-slot] .sidebar.rail-only .activity-bar {
		border-right-color: transparent;
		border-radius: ${INNER};
	}
	/* The drag area is centred on the gap between the panels (its offset starts inside the sidebar's
	   1px border); the line and grip centre in the drag area. */
	[data-abt-sidebar-slot] .sidebar {
		/* Border, half the gap and half the drag area; Chrome rejects calc() here. */
		overflow-clip-margin: 9px; /* raw: no calc() */
	}
	[data-abt-sidebar-slot] .sidebar .resize-handle {
		right: calc(-1 * ${MID} - 5px);
	}
	[data-abt-sidebar-slot] .sidebar .resize-grip {
		right: calc(50% - 4.5px);
	}
	[data-abt-sidebar-slot] .sidebar .resize-handle::after {
		/* 1px clear of each border: a fixed width leaves fractional margins that round unevenly. */
		width: calc(${GAP} - 2px);
		right: calc(50% - (${GAP} - 2px) / 2);
		top: ${RADIUS};
		height: calc(100% - 2 * ${RADIUS});
		border-radius: var(--abt-radius-pill);
	}
	/* The sidebar's clip reaches past its corners for the grip, so the header's hover rounds itself. */
	[data-abt-sidebar-slot] .sidebar.split :is(.budget-select, .budget-header) {
		border-top-right-radius: ${INNER};
	}
	[data-abt-sidebar-slot] .sidebar:not(.split) :is(.budget-select, .budget-header) {
		border-radius: ${INNER} ${INNER} 0 0;
	}
`;

// An app-wide side panel (the theme studio) is a full-height card of its own beside the page's: the
// page card's frame moves onto the titlebar and page column. Page panels stay inside the page card.
const OPEN = "[data-abt-page-card] > [data-abt-panel-open][data-abt-panel-app]";
const SIDE_PANEL = `
	/* No border at all, not a transparent one: the titlebar's and page's own borders take its place. */
	[data-abt-page-card]:has(> [data-abt-panel-open][data-abt-panel-app]) {
		border-width: 0;
		border-radius: 0;
		background: transparent !important;
		overflow: visible;
	}
	${OPEN} {
		column-gap: ${GAP};
		background: transparent !important;
	}
	/* Not the bottom: that's the titlebar's own divider. */
	${OPEN} > div:nth-child(1) {
		border-top: 1px solid var(--abt-inset-border);
		border-inline: 1px solid var(--abt-inset-border);
		border-radius: ${RADIUS} ${RADIUS} 0 0;
	}
	${OPEN} > div:nth-child(n + 4):not([data-abt-side-drawer-sidebar]) {
		border: 1px solid var(--abt-inset-border);
		border-top: none;
		border-radius: 0 0 ${RADIUS} ${RADIUS};
	}
	${OPEN} > [data-abt-side-drawer-sidebar] {
		${CARD}
		/* The page card's surface, so the same border reads the same on both. */
		background: var(--color-pageBackground);
	}
	/* Centred on the gap, as the sidebar's is (its offset starts inside the panel's border). */
	${OPEN} .abt-side-drawer-resize-handle {
		left: calc(-1 * ${MID} - 5.5px);
	}
	${OPEN} .abt-side-drawer-resize-handle::before {
		width: calc(${GAP} - 2px);
		left: calc(50% - (${GAP} - 2px) / 2);
		top: ${RADIUS};
		bottom: auto;
		height: calc(100% - 2 * ${RADIUS});
		border-radius: var(--abt-radius-pill);
	}
	${OPEN} > [data-abt-side-drawer-sidebar] > * {
		border-radius: ${INNER};
		overflow: hidden;
	}
`;

export const FLOATING_ATTR = "data-abt-inset-floating";

// The sidebar takes the frame's place: one colour, no border, so only the page stands out.
const FLOATING = `
	& {
		--abt-window-color: var(--color-sidebarBackground);
	}
	[data-abt-shell] {
		background: var(--color-sidebarBackground) !important;
	}
	[data-abt-sidebar-root],
	[data-abt-sidebar-slot] .sidebar {
		border-color: transparent;
	}
`;

// Cards with a sidebar unlike the page (a dark one on a light theme): the frame takes the sidebar's
// colour, a step deeper, so the sidebar card sits on its own shade instead of on the page's.
const CONTRAST_ATTR = "data-abt-inset-contrast";
const FRAME = "color-mix(in srgb, var(--color-sidebarBackground), black 22%)";
const CONTRAST = `
	&[${CONTRAST_ATTR}] {
		--abt-window-color: ${FRAME};
	}
	&[${CONTRAST_ATTR}] [data-abt-shell] {
		background: ${FRAME} !important;
	}
	&[${CONTRAST_ATTR}] :is([data-abt-sidebar-root], [data-abt-sidebar-slot] .sidebar) {
		border-color: color-mix(in srgb, var(--color-sidebarBackground), white 10%);
	}
	&[${CONTRAST_ATTR}] [data-abt-page-card] {
		border-color: transparent;
	}
`;

function luminance(color: string): number {
	const [r, g, b] = (color.match(/[\d.]+/g) ?? []).map(Number);
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function resolve(variable: string): string {
	const probe = document.createElement("div");
	probe.style.color = `var(${variable})`;
	document.body.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

function markContrast(): void {
	const apart =
		Math.abs(
			luminance(resolve("--color-sidebarBackground")) -
				luminance(resolve("--color-pageBackground")),
		) > 0.3;
	document.documentElement.toggleAttribute(CONTRAST_ATTR, apart);
	syncWindowColor();
}

type Mode = "off" | "cards" | "floating";

// A switch before it had a third option.
const modeOf = (value: unknown): Mode =>
	value === true ? "cards" : value === "cards" || value === "floating" ? value : "off";

export const insetPanels = defineSetting({
	type: "select",
	label: "Inset panels",
	description: "Shows the sidebar and page as rounded panels on a frame.",
	group: "General",
	icon: "panelsTopLeft",
	platform: "desktop",
	liveSidebarOnly: true,
	context: {
		key: "inset-panels",
		defaultValue: "off",
	},
	options: [
		{ value: "off", label: "Off" },
		{ value: "cards", label: "Cards" },
		{
			value: "floating",
			label: "Floating page",
			description: "Blends the sidebar into the frame, with only the page as a panel.",
		},
	],
	init: ({ key, value }) => {
		if (typeof value === "boolean") {
			void setValue(key, modeOf(value));
		}
		// The window's title bar follows the frame; it runs after the CSS is in and after it's gone.
		syncWindowColor();
		const mode = modeOf(value);
		if (mode !== "cards") {
			// For the theme's glow and grain to cover the frame the sidebar blends into.
			document.documentElement.toggleAttribute(FLOATING_ATTR, mode === "floating");
			return () => {
				document.documentElement.removeAttribute(FLOATING_ATTR);
				syncWindowColor();
			};
		}
		markContrast();
		document.addEventListener(THEME_APPLIED_EVENT, markContrast);
		return () => {
			document.removeEventListener(THEME_APPLIED_EVENT, markContrast);
			document.documentElement.removeAttribute(CONTRAST_ATTR);
			syncWindowColor();
		};
	},
	css: ({ value }) => {
		const mode = modeOf(value);
		return mode === "off"
			? ""
			: // Not with Actual's own sidebar, whose markup the panels aren't built around.
				desktopOnly(
					`:root[${LIVE_SIDEBAR_ATTR}] { ${CSS + SIDE_PANEL + (mode === "floating" ? FLOATING : CONTRAST)} }`,
				);
	},
});
