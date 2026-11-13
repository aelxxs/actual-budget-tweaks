import { defineSetting } from "@features/types";
import { watchDom } from "@lib/dom/dom-watcher";
import { LISTBOX, MODAL, OPTION } from "@lib/actual-dom";

/*
 * Actual's mobile transaction list: a virtualized listbox of date sections, each a <header> and
 * its rows. Each row is the option's only child; its button holds the details column, then the
 * amount column. Row heights are measured, so padding is safe but margins between rows aren't.
 */
const LIST_ATTR = "data-abt-m-txlist";
const ROW = `[${LIST_ATTR}] ${OPTION} > div`;
const CONTENT = `${ROW} button > div`;

function markLists() {
	for (const list of document.querySelectorAll(LISTBOX)) {
		// Date headers set it apart from autocomplete lists, which sit inside modals anyway.
		const isTransactions = !list.closest(MODAL) && !!list.querySelector("header");
		if (isTransactions !== list.hasAttribute(LIST_ATTR)) {
			list.toggleAttribute(LIST_ATTR, isTransactions);
		}
	}
}

export const mobileTransactionList = defineSetting({
	type: "checkbox",
	label: "Transaction list",
	description: "Shows transactions as a native list with date headings.",
	group: "Mobile",
	icon: "list",
	platform: "mobile",
	context: {
		key: "mobile-transaction-list",
		defaultValue: false,
	},
	css: () => `
		[${LIST_ATTR}] header {
			justify-content: flex-start !important;
			padding: var(--abt-space-5) var(--abt-space-5) var(--abt-space-2) !important;
			background: color-mix(in srgb, var(--color-mobilePageBackground) 88%, transparent) !important;
			backdrop-filter: blur(16px);
			color: var(--color-pageTextSubdued) !important;
			font-size: var(--abt-text-md) !important;
			font-weight: 600;
		}

		${ROW} {
			position: relative;
			height: auto !important;
			min-height: 60px;
			border-bottom-width: 0 !important;
		}

		/* Full width: most dates hold one row, so an inset line would end short above the next. */
		${ROW}::after {
			content: "";
			position: absolute;
			left: 0;
			right: 0;
			bottom: 0;
			border-bottom: 1px solid var(--color-tableBorder);
			pointer-events: none;
		}

		${ROW} button {
			padding: var(--abt-space-4) var(--abt-space-5) !important;
		}

		${CONTENT} {
			gap: var(--abt-space-4);
			padding: 0 !important;
		}

		/* Payee. */
		${CONTENT} > div:first-of-type > div:first-of-type {
			font-size: var(--abt-text-xl);
			font-weight: 500;
		}

		/* Category and notes. */
		${CONTENT} > div:first-of-type > div + div {
			margin-top: var(--abt-space-2) !important;
			font-size: var(--abt-text-md);
			color: var(--color-pageTextSubdued);
		}

		/* Amount. */
		${CONTENT} > div:last-of-type > span:first-of-type {
			font-size: var(--abt-text-xl) !important;
			font-weight: 500;
			font-variant-numeric: tabular-nums;
		}
	`,
	init: () => {
		const stop = watchDom(markLists);
		return () => {
			stop();
			for (const el of document.querySelectorAll(`[${LIST_ATTR}]`)) {
				el.removeAttribute(LIST_ATTR);
			}
		};
	},
});
