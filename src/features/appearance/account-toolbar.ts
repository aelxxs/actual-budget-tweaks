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
// Set while the toolbar is too narrow for its labels; the actions then show icons only.
const COMPACT_ATTR = "data-abt-compact";
// The row holding the balance and its details (cleared, uncleared, selected), behind « / ».
const DETAILS_ATTR = "data-abt-balance-details";
// Marks the titles added for compact mode, so they're removed with it.
const TITLE_ATTR = "data-abt-compact-title";
/*
 * Each part is classified in JS. As :has() and :empty rules these were rechecked on every DOM
 * change anywhere: one inserted node on the budget page cost ~50ms, and Firefox blanked the
 * transaction table while restyling.
 */
const PART_ATTR = "data-abt-toolbar-part";
const GLYPH_ATTR = "data-abt-glyph";
const BAR = `[${BAR_ATTR}]`;
const ACTIONS = `${BAR} [${PART_ATTR}="action"]`;
// The account menu's dots; an overflow menu reads last, after ABT's column reset.
const MENU = `${BAR} [${PART_ATTR}="menu"]`;
const SEARCH = `${BAR} [${PART_ATTR}="search"]`;
const ICONS = `${BAR} [${PART_ATTR}="icon"]`;
const DOTS = 'path[d^="M10 12a2 2 0 1 1"]';

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
	([, name]) => `
	${BAR} svg[${GLYPH_ATTR}="${name}"] {
		background: currentColor;
		mask: ${iconMask(name)} center / contain no-repeat;
	}
	${BAR} svg[${GLYPH_ATTR}="${name}"] > * {
		display: none;
	}`,
).join("");

function mark(el: Element, attr: string, value: string): void {
	if (el.getAttribute(attr) !== value) {
		el.setAttribute(attr, value);
	}
}

/** Marks the toolbar's parts: actions before Actual's empty spacer, search and icons after it. */
function classify(bar: HTMLElement): void {
	let afterSpacer = false;
	for (const child of bar.children) {
		if (child.tagName === "DIV" && !child.childNodes.length) {
			afterSpacer = true;
			continue;
		}
		const isSearch = afterSpacer && !!child.querySelector(":scope > input");
		const role = isSearch ? "search" : afterSpacer ? "icon" : "action";
		if (child.tagName === "BUTTON") {
			mark(child, PART_ATTR, role);
		} else if (isSearch) {
			mark(child, PART_ATTR, "search");
		} else {
			if (child.querySelector(DOTS)) {
				mark(child, PART_ATTR, "menu");
			}
			for (const button of child.querySelectorAll("button")) {
				mark(button, PART_ATTR, role);
			}
		}
	}
	for (const svg of bar.querySelectorAll("svg")) {
		const glyph = GLYPHS.find(([path]) => svg.querySelector(path))?.[1] ?? "";
		if (svg.querySelector("path")) {
			mark(svg, GLYPH_ATTR, glyph);
		}
	}
}

function unclassify(bar: HTMLElement): void {
	for (const el of bar.querySelectorAll(`[${PART_ATTR}], [${GLYPH_ATTR}]`)) {
		el.removeAttribute(PART_ATTR);
		el.removeAttribute(GLYPH_ATTR);
	}
}

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

	${BAR} svg[${GLYPH_ATTR}] {
		width: 15px !important;
		height: 15px !important;
		margin: 0 !important;
		flex-shrink: 0;
	}

	${swaps}

	/* The selected-transactions menu's caret: a dropdown chevron, smaller than the icons. */
	${BAR} svg[${GLYPH_ATTR}="chevronDown"] {
		width: 12px !important;
		height: 12px !important;
	}

	/* Actual turns its dots upright; ours already read across. Only these, so Bank Sync still spins. */
	${BAR} svg[${GLYPH_ATTR}="moreHorizontal"] {
		transform: none !important;
	}

	${BAR}[${COMPACT_ATTR}] :is(${ACTIONS}) {
		gap: 0;
		min-width: var(--abt-control-h);
		padding: 0 var(--abt-space-2) !important;
		/* Hides the label, a bare text node beside the icon; the icon has its own size. */
		font-size: 0 !important;
	}

	/* The balance details as stat columns: a small label over each value, split by hairlines. */
	[${DETAILS_ATTR}] {
		align-items: center;
		flex-wrap: wrap;
		row-gap: var(--abt-space-2);
	}

	[${DETAILS_ATTR}] > span {
		display: flex !important;
		flex-direction: column;
		gap: 1px;
		margin: 0 !important;
		padding: 0 var(--abt-space-5) !important;
		border-left: 1px solid var(--abt-line);
		border-radius: 0 !important;
		background: none !important;
		color: var(--abt-subtle);
		font-size: var(--abt-text-2xs) !important;
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.3;
		text-transform: uppercase;
	}

	[${DETAILS_ATTR}] > button + span {
		margin-left: var(--abt-space-3) !important;
	}

	[${DETAILS_ATTR}] > span > span {
		color: var(--color-pageText);
		font-size: var(--abt-text-md) !important;
		letter-spacing: 0;
		text-transform: none;
		font-variant-numeric: tabular-nums;
	}

	/* Search's look is shared with every search bar (base.css); it shrinks before anything wraps. */
	${SEARCH} {
		flex: 0 1 260px;
		min-width: 140px;
	}

	/* The icon buttons sit behind a hairline after search, drawn by search since what follows can be hidden. */
	${SEARCH} {
		position: relative;
		margin-right: var(--abt-space-4) !important;
	}

	/* Search's clear button sits inside the field, smaller than the toolbar's icons. */
	${SEARCH} button {
		padding: var(--abt-space-1) !important;
		border-radius: var(--abt-radius-sm) !important;
	}

	${SEARCH} button svg {
		width: 10px !important;
		height: 10px !important;
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

/** True when the toolbar's items no longer fit on one line. */
function wraps(bar: HTMLElement): boolean {
	// Actual's empty spacer has no height, so it's skipped; an item starting below another's bottom is on a new line.
	const boxes = [...bar.children]
		.map((c) => c.getBoundingClientRect())
		.filter((r) => r.width > 0 && r.height > 0);
	const firstBottom = Math.min(...boxes.map((r) => r.bottom));
	return boxes.some((r) => r.top >= firstBottom - 1);
}

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
		let bar: HTMLElement | null = null;

		const setCompact = (on: boolean) => {
			if (!bar) {
				return;
			}
			bar.toggleAttribute(COMPACT_ATTR, on);
			for (const button of bar.querySelectorAll<HTMLElement>(
				":scope > button, :scope > div button",
			)) {
				if (on && !button.title && button.textContent?.trim()) {
					button.title = button.textContent.trim();
					button.setAttribute(TITLE_ATTR, "");
				} else if (!on && button.hasAttribute(TITLE_ATTR)) {
					button.removeAttribute("title");
					button.removeAttribute(TITLE_ATTR);
				}
			}
		};

		// Tries the labels and keeps them if nothing wraps; both states are measured before a paint.
		const fit = () => {
			if (!bar) {
				return;
			}
			const wasCompact = bar.hasAttribute(COMPACT_ATTR);
			bar.removeAttribute(COMPACT_ATTR);
			const compact = wraps(bar);
			if (compact !== wasCompact) {
				setCompact(compact);
			} else if (compact) {
				bar.setAttribute(COMPACT_ATTR, "");
			}
		};
		// Width changes, and buttons coming and going (the selection menu, Bank Sync's spinner).
		const resize = new ResizeObserver(fit);
		const content = new MutationObserver(() => {
			if (bar) {
				classify(bar);
			}
			fit();
		});

		let details: Element | null = null;
		// Labels whose colon was dropped, with their text, to put back on teardown.
		const labels = new Map<Text, string>();

		const tidyDetails = () => {
			const row = document.querySelector('[data-testid="account-balance"]')?.parentElement ?? null;
			if (row !== details) {
				details?.removeAttribute(DETAILS_ATTR);
				details = row;
				details?.setAttribute(DETAILS_ATTR, "");
			}
			for (const node of labels.keys()) {
				if (!node.isConnected) {
					labels.delete(node);
				}
			}
			if (!row) {
				return;
			}
			// "Cleared total:" reads as a heading once it sits above its value.
			for (const chip of row.children) {
				const label = chip.firstChild;
				if (!(label instanceof Text) || !label.data.trimEnd().endsWith(":")) {
					continue;
				}
				labels.set(label, label.data);
				label.data = label.data.trimEnd().slice(0, -1);
			}
		};

		const unwatch = watchDom(() => {
			tidyDetails();
			if (bar?.isConnected) {
				return;
			}
			resize.disconnect();
			content.disconnect();
			bar = findAccountToolbar();
			if (!bar) {
				return;
			}
			bar.setAttribute(BAR_ATTR, "");
			classify(bar);
			resize.observe(bar);
			content.observe(bar, { childList: true, subtree: true, characterData: true });
		});

		return () => {
			unwatch();
			resize.disconnect();
			content.disconnect();
			setCompact(false);
			if (bar) {
				unclassify(bar);
			}
			bar?.removeAttribute(BAR_ATTR);
			bar = null;
			details?.removeAttribute(DETAILS_ATTR);
			details = null;
			for (const [node, text] of labels) {
				node.data = text;
			}
			labels.clear();
		};
	},
});
