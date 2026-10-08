import { defineSetting } from "@features/types";
import { type IconName, iconMask } from "@lib/icons";
import { watchDom } from "@lib/utilities/dom-watcher";
import { findAccountToolbar } from "@lib/utilities/native-ui";

/*
 * Adapter CSS for the account page's toolbar (Bank Sync, Import, Add New, Filter, search, then
 * reconcile, split toggle and the account menu). Its labels are translated, so it's read by
 * structure: the header holding the account name ends with the toolbar, whose empty flex spacer
 * splits the actions from search and the icon buttons. Some buttons sit in tooltip wrappers.
 * Actual's glyphs are told apart by the start of their path.
 */
const BAR_ATTR = "data-abt-account-toolbar";
// Matched once in JS: as a CSS anchor, these :has() checks ran for every svg in the
// transaction rows on each scroll frame, and Firefox blanked the table while restyling.
const BAR = `[${BAR_ATTR}]`;
const ACTIONS = `${BAR} > button:has(~ div:empty), ${BAR} > div:has(~ div:empty) button`;
// The account menu's dots; an overflow menu reads last, after ABT's column reset.
const MENU = `${BAR} > div:has(path[d^="M10 12a2 2 0 1 1"])`;
const SEARCH = `${BAR} > div:empty ~ div:has(> input)`;
const ICONS = `${BAR} > div:empty ~ button, ${BAR} > div:empty ~ div button`;

const GLYPHS: [string, IconName][] = [
	['path[d^="M10 3v2a5 5"]', "refreshCw"],
	['path[d^="M8.616 1.741"]', "download"],
	['path[d^="M23 11.5"]', "plus"],
	['path[d^="m12 12 8-8V0H0"]', "filter"],
	['path[d^="m23.384 21.619"]', "search"],
	['path[d^="M4 8V6a6 6"]', "lock"],
	['path[d^="M14.143 1.714"]', "minimize"],
	['path[d^="M19.611 2.571"]', "maximize"],
	['path[d^="M10 12a2 2 0 1 1"]', "moreHorizontal"],
	['path[d^="M24.483.576"]', "chevronDown"],
];

// Swaps a native glyph for ours by masking the svg itself, so React keeps owning its nodes.
const swaps = GLYPHS.map(
	([path, name]) => `
	${BAR} svg:has(${path}) {
		background: currentColor;
		mask: ${iconMask(name)} center / contain no-repeat;
	}
	${BAR} svg:has(${path}) > * {
		display: none;
	}`,
).join("");

const CSS = `
	${BAR} {
		align-items: center !important;
		gap: var(--abt-space-2) !important;
	}

	:is(${ACTIONS}),
	:is(${ICONS}) {
		display: inline-flex !important;
		align-items: center;
		justify-content: center;
		gap: 6px;
		box-sizing: border-box;
		height: var(--abt-control-h);
		border: 1px solid transparent !important;
		border-radius: var(--abt-radius) !important;
		color: var(--abt-muted) !important;
		font-size: var(--abt-text-base) !important;
		font-weight: 400 !important;
		transition:
			background 0.1s,
			color 0.1s,
			border-color 0.1s;
	}

	:is(${ACTIONS}) {
		padding: 0 var(--abt-space-4) 0 var(--abt-space-3) !important;
	}

	/* Icon buttons, and the selected-transactions button that joins them with a label. */
	:is(${ICONS}) {
		min-width: var(--abt-control-h);
		padding: 0 var(--abt-space-2) !important;
	}

	:is(${ACTIONS}):hover:not(:disabled),
	:is(${ICONS}):hover:not(:disabled),
	:is(${ICONS})[aria-expanded="true"] {
		background: var(--abt-fill-hover) !important;
		color: var(--color-pageText) !important;
	}

	${MENU} {
		order: 1;
	}

	${BAR} svg:has(path) {
		width: 15px !important;
		height: 15px !important;
		margin: 0 !important;
		flex-shrink: 0;
	}

	${swaps}

	/* The selected-transactions menu's caret: a dropdown chevron, smaller than the icons. */
	${BAR} svg:has(path[d^="M24.483.576"]) {
		width: 12px !important;
		height: 12px !important;
	}

	/* Actual turns its dots upright; ours already read across. Only these, so Bank Sync still spins. */
	${BAR} svg:has(path[d^="M10 12a2 2 0 1 1"]) {
		transform: none !important;
	}

	${SEARCH} {
		box-sizing: border-box;
		width: 260px;
		height: var(--abt-control-h);
		padding: 0 var(--abt-space-3) !important;
		gap: var(--abt-space-3);
		border: 1px solid var(--abt-line) !important;
		border-radius: var(--abt-radius) !important;
		background: var(--abt-fill) !important;
		box-shadow: none !important;
		color: var(--abt-muted);
		transition:
			border-color 0.1s,
			box-shadow 0.1s;
	}

	${SEARCH}:focus-within {
		border-color: var(--abt-accent-4) !important;
		box-shadow: 0 0 0 3px var(--abt-accent-2) !important;
	}

	${SEARCH} input {
		padding: 0 !important;
		background: transparent !important;
		font-size: var(--abt-text-base) !important;
	}

	/* The icon buttons sit behind a hairline after search, drawn by search since what follows can be hidden. */
	${SEARCH} {
		position: relative;
		margin-right: var(--abt-space-4) !important;
	}

	${SEARCH}::after {
		content: "";
		position: absolute;
		top: 6px;
		right: calc(-1 * var(--abt-space-3) - 1px);
		bottom: 6px;
		width: 1px;
		background: var(--abt-line);
	}
`;

export const modernAccountToolbar = defineSetting({
	type: "checkbox",
	label: "Modern Account Toolbar",
	description: "Restyles the account page's actions, search and icon buttons with matching icons.",
	group: "General",
	icon: "layout",
	context: {
		key: "modern-account-toolbar",
		defaultValue: true,
	},
	css: () => CSS,
	init: () => {
		let bar: Element | null = null;

		const unwatch = watchDom(() => {
			if (bar?.isConnected) return;
			bar = findAccountToolbar();
			bar?.setAttribute(BAR_ATTR, "");
		});

		return () => {
			unwatch();
			bar?.removeAttribute(BAR_ATTR);
			bar = null;
		};
	},
});
