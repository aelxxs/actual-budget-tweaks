import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import { unmount } from "svelte";
import SummaryRow from "./SummaryRow.svelte";
import { summaryState } from "./state.svelte";

const SELECTED_CELL = '[data-testid="selected-budget-month"][data-month]';
const SINGLE_MONTH_ATTR = "data-abt-single-month";
const FULL_WIDTH_ATTR = "data-abt-summary-full-width";
const SUMMARY_CARD_ATTR = "data-abt-summary-row";
const SUMMARY_STATS_ATTR = "data-abt-summary-stats";
const REFRESH_MS = 250;
/**
 * Keyed to the table rather than each card: Actual renders a new month's card a frame
 * before sync() could mark it, and that frame would show the tall native card.
 */
const SUMMARY_CARD = `[${SINGLE_MONTH_ATTR}] [data-testid="budget-summary"]`;

let summary: {
	card: HTMLElement;
	node: HTMLElement;
	instance: unknown;
	observer: MutationObserver;
} | null = null;

function unmountSummary(): void {
	if (!summary) return;
	summary.observer.disconnect();
	unmount(summary.instance as never);
	summary.node.remove();
	summary = null;
}

function restoreNative(): void {
	unmountSummary();
	for (const attr of [SINGLE_MONTH_ATTR, SUMMARY_CARD_ATTR, FULL_WIDTH_ATTR]) {
		for (const el of document.querySelectorAll(`[${attr}]`)) el.removeAttribute(attr);
	}
}

/**
 * With one month shown, Actual's month card becomes a full-width summary row: its own
 * To Budget (and its menu) stays, with ABT's breakdown, spending, and targets beside it.
 */
function sync(): void {
	if (!matchesPage(Page.Budget)) {
		unmountSummary();
		return;
	}
	const table = document.querySelector<HTMLElement>('[data-testid="budget-table"]');
	const parent = table?.parentElement;
	if (!table || !parent) return;
	// Actual's month header (hidden by the month header feature, but still mounted).
	const months = [...parent.querySelectorAll<HTMLElement>(SELECTED_CELL)].map(
		(cell) => cell.dataset.month!,
	);
	const single = months.length === 1;
	table.toggleAttribute(SINGLE_MONTH_ATTR, single);
	parent.toggleAttribute(FULL_WIDTH_ATTR, single);
	// Every card in Actual's sliding carousel, so neighbours don't change shape mid-slide.
	const cards = [...table.querySelectorAll<HTMLElement>('[data-testid="budget-summary"]')];
	for (const card of cards) card.toggleAttribute(SUMMARY_CARD_ATTR, single);

	const card = single ? cards.find((c) => c.dataset.month === months[0]) : undefined;
	if (summary && summary.card === card && summary.node.isConnected) return;
	unmountSummary();
	const toBudget = card?.lastElementChild;
	if (!card || !toBudget) return;

	const { node, instance } = mountToNodeWithReturn(SummaryRow, {
		sheet: `budget${months[0].replace("-", "")}`,
	});
	node.setAttribute(SUMMARY_STATS_ATTR, "");
	card.insertBefore(node, toBudget);

	// Any edit or new transaction rewrites cell text in the table; our own renders don't count.
	let timer: ReturnType<typeof setTimeout> | undefined;
	const observer = new MutationObserver((records) => {
		if (records.every((r) => node.contains(r.target))) return;
		clearTimeout(timer);
		timer = setTimeout(() => summaryState.version++, REFRESH_MS);
	});
	observer.observe(table, { childList: true, subtree: true, characterData: true });
	summary = { card, node, instance, observer };
}

export const budgetSummaryRow = defineSetting({
	type: "checkbox",
	label: "Single-month summary (experimental)",
	description:
		"When one month is shown, replace its card with a full-width row: To Budget, spending, targets, and quick budget actions.",
	icon: "sparkles",
	group: "Budget",
	context: {
		key: "budget-summary-row",
		defaultValue: false,
	},
	css: () => `
		/* Actual caps the table at its columns' natural width (500px a month); fill the page instead. */
		[${FULL_WIDTH_ATTR}] { max-width: none !important; }

		/* Drop the category-column spacer so the card spans the table. */
		[${SINGLE_MONTH_ATTR}] > :first-child > :first-child { display: none !important; }

		/* Actual's card becomes a transparent row of separate cards. */
		${SUMMARY_CARD} {
			flex-direction: row !important;
			flex-wrap: wrap;
			align-items: stretch !important;
			gap: 10px;
			background: none !important;
			box-shadow: none !important;
			border: 0 !important;
			border-radius: 0 !important;
			overflow: visible !important;
		}
		/* Header: keep notes and the month menu, drop the title and collapse toggle. */
		${SUMMARY_CARD} > :first-child {
			order: 2;
			align-self: center;
			margin: 0 !important;
			padding: 0 !important;
		}
		${SUMMARY_CARD} > :first-child > :not(:last-child) { display: none !important; }
		${SUMMARY_CARD} > :first-child > :last-child { position: static !important; }
		/* Actual's totals and ABT's flow bar: the summary cards cover them. */
		${SUMMARY_CARD} > :not(:first-child):not(:last-child):not([${SUMMARY_STATS_ATTR}]) {
			display: none !important;
		}
		[${SUMMARY_STATS_ATTR}] { display: contents; }
		/* Actual's To Budget, menu and all, is the lead card. */
		${SUMMARY_CARD} > :last-child {
			position: relative;
			order: 0;
			flex: 1.4 1 auto;
			min-width: 150px;
			margin: 0 !important;
			padding: 10px 16px !important;
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
	`,
	init: () => {
		const unwatch = watchDom(sync);
		return () => {
			unwatch();
			restoreNative();
		};
	},
});
