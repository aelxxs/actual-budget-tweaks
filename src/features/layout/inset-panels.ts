import { defineSetting } from "@features/types";
import { desktopOnly } from "@lib/utilities/pages";

const GAP = "var(--abt-space-2)";
// Wider than the gap between the panels, so they clear the window's rounded corners.
const EDGE = "calc(var(--abt-space-2) + var(--abt-space-1))";
const INNER = "calc(var(--abt-radius-lg) - 1px)";
const CARD = `
	border: 1px solid var(--abt-inset-border);
	border-radius: var(--abt-radius-lg);
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
	[data-abt-sidebar-slot] .sidebar .resize-handle::after {
		top: var(--abt-radius-lg);
		height: calc(100% - 2 * var(--abt-radius-lg));
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
