import { defineSetting } from "@features/types";
import { isCalendarOpen } from "@features/workflows/spending-calendar";
import { icon } from "@lib/icons";
import { watchDom, watchElement } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import { unmount } from "svelte";
import MonthMeta from "./MonthMeta.svelte";
import SummaryRow from "./SummaryRow.svelte";
import { markSheetsStale, sheetsInMutations } from "@features/readability/category-progress/cells";
import { summaryState } from "./state.svelte";

const BUDGET_TABLE = '[data-testid="budget-table"]';
const SELECTED_CELL = '[data-testid="selected-budget-month"][data-month]';
const SINGLE_MONTH_ATTR = "data-abt-single-month";
const MULTI_MONTH_ATTR = "data-abt-multi-month";
const FULL_WIDTH_ATTR = "data-abt-summary-full-width";
const SUMMARY_CARD_ATTR = "data-abt-summary-row";
const SUMMARY_STATS_ATTR = "data-abt-summary-stats";
const MONTH_META_ATTR = "data-abt-month-meta";
const CURRENT_MONTH_ATTR = "data-abt-current-month";
const RESIZING_ATTR = "data-abt-month-count-changing";
const REFRESH_MS = 250;
/** Both modes' card height, so switching between them never moves the table. */
const CARD_HEIGHT = 92;
/** ABT's notes icon, drawn over Actual's notes button so the button itself stays Actual's. */
const NOTE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	icon("note", { size: 24 }).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '),
)}")`;
/**
 * Keyed to the table rather than each card: Actual renders a new month's card a frame
 * before sync() could mark it, and that frame would show the tall native card.
 */
const SUMMARY_CARD = `[${SINGLE_MONTH_ATTR}] [data-testid="budget-summary"]`;
const MONTH_CARD = `[${MULTI_MONTH_ATTR}] [data-testid="budget-summary"]`;

interface Mounted {
	node: HTMLElement;
	instance: unknown;
}

let summary: (Mounted & { card: HTMLElement }) | null = null;
const metas = new Map<HTMLElement, Mounted>();
let observed: { table: HTMLElement; observer: MutationObserver } | null = null;

function drop(mounted: Mounted): void {
	unmount(mounted.instance as never);
	mounted.node.remove();
}

function unmountSummary(): void {
	if (summary) drop(summary);
	summary = null;
}

function unmountMetas(keep?: (card: HTMLElement) => boolean): void {
	for (const [card, meta] of metas) {
		if (keep?.(card)) continue;
		drop(meta);
		metas.delete(card);
	}
}

function unmountAll(): void {
	unmountSummary();
	unmountMetas();
	carouselResize?.observer.disconnect();
	carouselResize = null;
	observed?.observer.disconnect();
	observed = null;
}

function restoreNative(): void {
	unmountAll();
	releaseCarousel();
	document
		.querySelector<HTMLElement>('[data-testid="budget-table"]')
		?.style.removeProperty("--abt-months");
	for (const attr of [
		SINGLE_MONTH_ATTR,
		MULTI_MONTH_ATTR,
		SUMMARY_CARD_ATTR,
		FULL_WIDTH_ATTR,
		RESIZING_ATTR,
		CURRENT_MONTH_ATTR,
	]) {
		for (const el of document.querySelectorAll(`[${attr}]`)) el.removeAttribute(attr);
	}
}

const shownSheets = (table: HTMLElement) =>
	shownMonths(table).map((month) => `budget${month.replace("-", "")}`);

function shownMonths(table: HTMLElement): string[] {
	// Actual's month header (hidden by the month header feature, but still mounted).
	return [...(table.parentElement?.querySelectorAll<HTMLElement>(SELECTED_CELL) ?? [])].map(
		(cell) => cell.dataset.month!,
	);
}

/** Marks the table single- or multi-month, which is what the CSS keys on. */
let shownCount = 0;
let carouselHold: MutationObserver | null = null;
let carouselResize: { box: Element; observer: ResizeObserver } | null = null;

function applyMode(table: HTMLElement): { months: string[]; cards: HTMLElement[] } {
	const months = shownMonths(table);
	const single = months.length === 1;
	if (months.length && months.length !== shownCount) {
		const changed = shownCount > 0;
		shownCount = months.length;
		if (changed) holdCarousel(table);
	}
	// Per table: Actual replaces the table when the page comes back from the calendar.
	if (shownCount && table.style.getPropertyValue("--abt-months") !== String(shownCount)) {
		table.style.setProperty("--abt-months", String(shownCount));
	}
	table.toggleAttribute(SINGLE_MONTH_ATTR, single);
	table.toggleAttribute(MULTI_MONTH_ATTR, months.length > 1);
	table.parentElement?.toggleAttribute(FULL_WIDTH_ATTR, single);
	const cards = [...table.querySelectorAll<HTMLElement>('[data-testid="budget-summary"]')];
	const now = new Date();
	const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	for (const card of cards) {
		card.toggleAttribute(SUMMARY_CARD_ATTR, single);
		card.toggleAttribute(CURRENT_MONTH_ATTR, card.dataset.month === current);
	}
	return { months, cards };
}

/**
 * Actual's month carousel keeps its old offset and width for a few frames after the month
 * count changes, which bunches the months mid-page. Pin them to their resting values until
 * Actual writes matching ones; not always, since month navigation animates the same transform.
 */
function holdCarousel(table: HTMLElement): void {
	releaseCarousel();
	const row = carouselRow(table);
	if (!row || carouselSettled(table)) return;
	table.setAttribute(RESIZING_ATTR, "");
	carouselHold = new MutationObserver(() => {
		if (carouselSettled(table)) releaseCarousel();
	});
	carouselHold.observe(row, { attributes: true, attributeFilter: ["style"] });
}

/**
 * Opening the side panel or sidebar resizes the carousel, and Actual's offset lags the new
 * width the same way, letting the next month slide in at the edge; hold it there too.
 */
function watchCarouselWidth(table: HTMLElement): void {
	const box = carouselRow(table)?.parentElement;
	if (!box || carouselResize?.box === box) return;
	carouselResize?.observer.disconnect();
	let width = 0;
	const observer = new ResizeObserver(([entry]) => {
		const next = entry.contentRect.width;
		if (width && next !== width) holdCarousel(table);
		width = next;
	});
	observer.observe(box);
	carouselResize = { box, observer };
}

function releaseCarousel(): void {
	carouselHold?.disconnect();
	carouselHold = null;
	document.querySelector(`[${RESIZING_ATTR}]`)?.removeAttribute(RESIZING_ATTR);
}

const carouselRow = (table: HTMLElement) =>
	table.querySelector<HTMLElement>('[data-testid="budget-summary"]')?.parentElement?.parentElement;

/** Whether Actual's inline width and offset match the resting ones the CSS pins. */
function carouselSettled(table: HTMLElement): boolean {
	const row = carouselRow(table);
	const parent = row?.parentElement;
	if (!row || !parent || !shownCount) return true;
	const width = parseFloat(row.style.width);
	const offset = parseFloat(row.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1] ?? "");
	return (
		Math.abs(width - parent.getBoundingClientRect().width) < 1 &&
		Math.abs(offset + width / shownCount) < 1
	);
}

/**
 * Re-marks the mode and mounts its parts before the browser paints, since Actual renders
 * the new month count a frame before the debounced sync() would; and refreshes the totals.
 */
function observe(table: HTMLElement): void {
	if (observed?.table === table) return;
	observed?.observer.disconnect();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const changed = new Set<string>();
	let shown = shownSheets(table);
	const observer = new MutationObserver((records) => {
		// Actual drops the table when the page is hidden (the calendar). Its cards are never
		// kept once detached, so syncing them would remount them forever; sync() finds the new one.
		if (!table.isConnected) {
			unmountAll();
			return;
		}
		syncParts(table);
		// Only the months whose cells changed re-read; our own renders change none.
		const now = shownSheets(table);
		const moved = now.join() !== shown.join();
		const sheets = sheetsInMutations(records, moved ? shown : undefined);
		shown = now;
		if (!sheets.size) return;
		markSheetsStale(sheets);
		for (const sheet of sheets) changed.add(sheet);
		clearTimeout(timer);
		timer = setTimeout(() => {
			for (const sheet of changed) {
				summaryState.versions[sheet] = (summaryState.versions[sheet] ?? 0) + 1;
			}
			changed.clear();
		}, REFRESH_MS);
	});
	observer.observe(table.parentElement ?? table, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ["data-testid", "data-month"],
	});
	observed = { table, observer };
}

/**
 * With one month shown, Actual's month card becomes a full-width summary row: its own
 * To Budget (and its menu) stays, with ABT's breakdown, spending, and targets beside it.
 */
function syncSummary(cards: HTMLElement[], month: string | undefined): void {
	const card = month ? cards.find((c) => c.dataset.month === month) : undefined;
	if (summary && summary.card === card && summary.node.isConnected) return;
	unmountSummary();
	const toBudget = card?.lastElementChild;
	if (!card || !toBudget || !month) return;
	const { node, instance } = mountToNodeWithReturn(SummaryRow, {
		sheet: `budget${month.replace("-", "")}`,
	});
	node.setAttribute(SUMMARY_STATS_ATTR, "");
	card.insertBefore(node, toBudget);
	summary = { card, node, instance };
}

/**
 * With several months shown, each card (the carousel's off-screen ones too, so they
 * don't change shape mid-slide) becomes a one-line header: month, year, To Budget.
 */
function syncMetas(cards: HTMLElement[], multi: boolean): void {
	unmountMetas((card) => multi && card.isConnected && !!metas.get(card)?.node.isConnected);
	if (!multi) return;
	for (const card of cards) {
		const toBudget = card.lastElementChild;
		if (metas.has(card) || !card.dataset.month || !toBudget) continue;
		const { node, instance } = mountToNodeWithReturn(MonthMeta, {
			card,
			month: card.dataset.month,
		});
		node.setAttribute(MONTH_META_ATTR, "");
		card.insertBefore(node, toBudget);
		metas.set(card, { node, instance });
	}
}

function sync(): void {
	// The budget page stays mounted, hidden, under the calendar; ABT's parts stay with it.
	if (isCalendarOpen()) return;
	if (!matchesPage(Page.Budget)) {
		unmountAll();
		return;
	}
	const table = document.querySelector<HTMLElement>(BUDGET_TABLE);
	if (!table?.parentElement) return;
	const fresh = observed?.table !== table;
	observe(table);
	syncParts(table);
	// A new table's carousel starts at zero width and slides into place over a few frames.
	if (fresh) holdCarousel(table);
}

/** Marks the mode and mounts its parts; idempotent, so it's safe on every mutation. */
function syncParts(table: HTMLElement): void {
	const { months, cards } = applyMode(table);
	watchCarouselWidth(table);
	syncSummary(cards, months.length === 1 ? months[0] : undefined);
	syncMetas(cards, months.length > 1);
}

export const budgetSummaryRow = defineSetting({
	type: "checkbox",
	label: "Month cards (experimental)",
	description:
		"Compact month headers when several months are shown; with one, a full-width row of To Budget, spending, targets, and quick budget actions.",
	icon: "sparkles",
	group: "Budget",
	context: {
		key: "budget-summary-row",
		defaultValue: false,
	},
	/*
	 * Adapter CSS: this restyles Actual's own month cards, which have no class hooks, so the
	 * selectors are structural and !important beats Actual's generated styles. ABT's own parts
	 * use the shared utilities in src/lib/styles/ui.css instead.
	 */
	css: () => `
		/*
		 * The carousel row (the element whose grandchildren are the month cards) at rest: the
		 * shown months plus one off-screen each side, shifted left by one month.
		 */
		[${RESIZING_ATTR}] :has(> * > [data-testid="budget-summary"]) {
			width: 100% !important;
			transform: translateX(calc(-100% / var(--abt-months))) !important;
		}
		[${RESIZING_ATTR}] :has(> * > [data-testid="budget-summary"]) > * {
			flex: 0 0 calc(100% / var(--abt-months)) !important;
		}

		/* Actual caps the table at its columns' natural width (500px a month); fill the page instead. */
		[${FULL_WIDTH_ATTR}] { max-width: none !important; }

		/*
		 * One month shown: its column uses Actual's other-month colour even when it's the current
		 * month, for contrast. ABT's surfaces are defined from the current-month colour at the
		 * root, so the summary cards keep theirs.
		 */
		[${SINGLE_MONTH_ATTR}] { --color-budgetCurrentMonth: var(--color-budgetOtherMonth); }

		/* Drop the category-column spacer so the card spans the table. */
		[${SINGLE_MONTH_ATTR}] > :first-child > :first-child { display: none !important; }

		/* Actual's card becomes a transparent row of separate cards. */
		${SUMMARY_CARD} {
			flex-direction: row !important;
			flex-wrap: wrap;
			align-items: stretch !important;
			gap: var(--abt-space-3);
			background: none !important;
			box-shadow: none !important;
			/* Transparent, not the text colour: Actual animates the border back in multi-month. */
			border: 0 solid transparent !important;
			border-radius: 0 !important;
			transition: none !important;
			overflow: visible !important;
		}
		/*
		 * Header: only Actual's notes button stays, tucked into the To Budget card's corner. The
		 * header becomes a zero-width item right after that card (order 1), pulled back over the
		 * row gap, so its button can sit inside the card without being moved in the DOM.
		 */
		${SUMMARY_CARD} > :first-child {
			order: 1;
			position: relative;
			flex: 0 0 0;
			width: 0;
			min-width: 0;
			align-self: stretch;
			margin: 0 0 0 calc(-1 * var(--abt-space-3)) !important;
			padding: 0 !important;
		}
		${SUMMARY_CARD} > :first-child > :not(:last-child) { display: none !important; }
		/* Offsets include the card's 1px border, to line up with the Insights shortcut inside it. */
		${SUMMARY_CARD} > :first-child > :last-child {
			position: absolute !important;
			top: calc(var(--abt-space-2) + 1px);
			right: calc(var(--abt-space-2) + 1px);
			z-index: 1;
		}
		/* Beside the Insights breakdown shortcut, when that's in the corner. */
		${SUMMARY_CARD}:has([data-abt-summary-more]) > :first-child > :last-child {
			right: calc(var(--abt-space-2) + 1px + var(--abt-control-h-sm) + var(--abt-space-1));
		}
		/* Actual's notes button, sized and styled like the shortcut beside it. */
		${SUMMARY_CARD} > :first-child > :last-child button {
			display: grid !important;
			place-items: center;
			box-sizing: border-box;
			width: var(--abt-control-h-sm);
			height: var(--abt-control-h-sm);
			padding: 0 !important;
			border-radius: var(--abt-radius) !important;
		}
		/* ABT's notes icon in place of Actual's, matching the Insights icon beside it. */
		${SUMMARY_CARD} > :first-child > :last-child button svg,
		${MONTH_CARD} > :first-child > :last-child button svg {
			display: none !important;
		}
		${SUMMARY_CARD} > :first-child > :last-child button::before,
		${MONTH_CARD} > :first-child > :last-child button::before {
			content: "";
			width: 17px;
			height: 17px;
			background: currentColor;
			-webkit-mask: ${NOTE_MASK} center / contain no-repeat;
			mask: ${NOTE_MASK} center / contain no-repeat;
		}
		${SUMMARY_CARD} > :first-child > :last-child button:hover {
			background: var(--abt-fill-hover) !important;
		}
		/* Actual's month menu: Budget Actions covers everything in it. */
		${SUMMARY_CARD} > :first-child > :last-child > :last-child:not(:first-child),
		${MONTH_CARD} > :first-child > :last-child > :last-child:not(:first-child) {
			display: none !important;
		}
		/* Actual's totals and ABT's flow bar: the summary cards cover them. */
		${SUMMARY_CARD} > :not(:first-child):not(:last-child):not([${SUMMARY_STATS_ATTR}]) {
			display: none !important;
		}
		/* Each mode's pieces show only in that mode, including the frame before they unmount. */
		[${SUMMARY_STATS_ATTR}], [${MONTH_META_ATTR}] { display: none; }
		${SUMMARY_CARD} > [${SUMMARY_STATS_ATTR}] { display: contents; }
		/* Actual's To Budget, menu and all, is the lead card. */
		${SUMMARY_CARD} > :last-child {
			position: relative;
			order: 0;
			flex: 1.4 1 auto;
			/* The cards' height, held before they mount. */
			box-sizing: border-box;
			min-height: ${CARD_HEIGHT}px;
			align-items: flex-start !important;
			min-width: 150px;
			margin: 0 !important;
			padding: var(--abt-space-3) var(--abt-space-5) !important;
			justify-content: center;
			border: 1px solid var(--abt-panel-border) !important;
			border-radius: var(--abt-radius);
			background:
				linear-gradient(135deg, color-mix(in srgb, var(--color-noticeTextLight) 14%, transparent), transparent 70%),
				var(--abt-panel-surface) !important;
		}
		${SUMMARY_CARD}[data-abt-to-budget-negative] > :last-child {
			background:
				linear-gradient(135deg, color-mix(in srgb, var(--color-errorText) 14%, transparent), transparent 70%),
				var(--abt-panel-surface) !important;
		}
		${SUMMARY_CARD} > :last-child > * { margin: 0 !important; }
		/* Same label colour as the summary cards; the subdued default is faint on the tint. */
		${SUMMARY_CARD} > :last-child,
		${SUMMARY_CARD} > :last-child .abt-to-budget-label {
			color: var(--color-tableHeaderText) !important;
		}
		${SUMMARY_CARD} > :last-child *:not([data-abt-summary-more], [data-abt-summary-more] *) {
			align-items: flex-start !important;
			text-align: left !important;
			padding-left: 0 !important;
		}

		/*
		 * Several months: each card becomes a two-line header, the month then To Budget. A grid
		 * gives every piece a fixed cell, so nothing moves while ABT's parts mount.
		 */
		${MONTH_CARD} {
			display: grid !important;
			/* Month, year, tag, space, then notes/menu above the actions. */
			grid-template-columns: minmax(0, auto) auto auto 1fr auto;
			grid-template-rows: auto var(--abt-control-h-sm);
			align-content: start;
			align-items: center !important;
			gap: var(--abt-space-3);
			/* Shared with the single-month row, so switching modes doesn't move the table. */
			box-sizing: border-box;
			flex: none !important;
			height: ${CARD_HEIGHT}px;
			padding: var(--abt-space-4) var(--abt-space-3) 0 var(--abt-space-5) !important;
			container-type: inline-size;
			overflow: visible !important;
		}
		/* The current month, tinted like its Now tag. */
		${MONTH_CARD}[${CURRENT_MONTH_ATTR}] {
			border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent) !important;
			background:
				linear-gradient(
					135deg,
					color-mix(in srgb, var(--color-sidebarItemAccentSelected) 14%, transparent),
					transparent 70%
				),
				var(--color-budgetCurrentMonth, var(--abt-panel-surface)) !important;
		}
		/* Header: its title and notes/menu join the row; the collapse toggle has nothing to collapse. */
		${MONTH_CARD} > :first-child { display: contents !important; }
		${MONTH_CARD} > :first-child > :first-child { display: none !important; }
		${MONTH_CARD} > :first-child > :not(:first-child):not(:last-child) {
			grid-area: 1 / 1;
			align-self: baseline;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: var(--abt-text-lg) !important;
			font-weight: 650 !important;
		}
		${MONTH_CARD} > :first-child > :last-child {
			grid-area: 1 / 5;
			justify-self: end;
			position: static !important;
		}
		/* Totals and ABT's flow bar move into the To Budget hover. */
		${MONTH_CARD} > :not(:first-child):not(:last-child):not([${MONTH_META_ATTR}]) {
			display: none !important;
		}
		${MONTH_CARD} > [${MONTH_META_ATTR}] { display: contents; }
		/* Actual's To Budget, menu and all: label and amount, beside the suggested action. */
		${MONTH_CARD} > :last-child {
			grid-area: 2 / 1 / 3 / 5;
			align-items: flex-start !important;
			min-width: 0;
			/* Actual's divider above it separated the totals, which are hidden here. */
			border: 0 !important;
			margin: 0 !important;
			padding: 0 !important;
			background: none !important;
			font-size: var(--abt-text-xs) !important;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			color: var(--color-tableHeaderText) !important;
		}
		${MONTH_CARD} > :last-child * {
			flex-direction: row !important;
			align-items: baseline !important;
			gap: var(--abt-space-2);
			margin: 0 !important;
			padding: 0 !important;
			font-size: inherit !important;
			color: inherit !important;
		}
		/* Narrow months keep the amount and drop the label. */
		@container (max-width: 320px) {
			${MONTH_CARD} > :last-child > * > * > :first-child:not(:has([data-cellname])) {
				display: none !important;
			}
		}
		${MONTH_CARD} > :last-child [data-cellname],
		${MONTH_CARD} > :last-child [data-cellname] * {
			font-size: var(--abt-text-lg) !important;
			font-weight: 650;
			letter-spacing: 0;
			text-transform: none;
			font-variant-numeric: tabular-nums;
			color: var(--color-noticeTextLight) !important;
		}
		${MONTH_CARD}[data-abt-to-budget-negative] > :last-child [data-cellname],
		${MONTH_CARD}[data-abt-to-budget-negative] > :last-child [data-cellname] * {
			color: var(--color-errorText) !important;
		}
	`,
	init: () => {
		const unwatch = watchDom(sync);
		const unwatchTable = watchElement(BUDGET_TABLE, sync);
		return () => {
			unwatch();
			unwatchTable();
			restoreNative();
		};
	},
});
