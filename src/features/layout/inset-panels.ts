import { defineSetting } from "@features/types";
import { desktopOnly } from "@lib/utilities/pages";
import { setValue } from "@lib/utilities/store";
import { syncWindowColor } from "@features/theme/theme-apply";

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

// The sidebar takes the frame's place: one colour, no border, so only the page stands out.
const FLOATING = `
	:root {
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
		return () => syncWindowColor();
	},
	css: ({ value }) => {
		const mode = modeOf(value);
		return mode === "off" ? "" : desktopOnly(mode === "floating" ? CSS + FLOATING : CSS);
	},
});
