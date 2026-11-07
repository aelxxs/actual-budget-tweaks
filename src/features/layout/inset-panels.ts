import { defineSetting } from "@features/types";
import { desktopOnly } from "@lib/utilities/pages";

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

export const insetPanels = defineSetting({
	type: "checkbox",
	label: "Inset Panels",
	description:
		"Sets the sidebar and page as rounded panels on a frame that matches the window's title bar.",
	group: "General",
	icon: "layout",
	platform: "desktop",
	context: {
		key: "inset-panels",
		defaultValue: false,
	},
	css: () => desktopOnly(CSS),
});
