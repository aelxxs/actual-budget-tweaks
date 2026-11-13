import { defineSetting } from "@features/types";
import ColorTransactionsPreview from "./previews/ColorTransactions.svelte";
import { watchDom } from "@lib/utilities/dom-watcher";
import {
	ACCOUNT_CELL,
	CATEGORY_CELL,
	CREDIT_CELL,
	DATE_CELL,
	DEBIT_CELL,
	NOTES_CELL,
	PAYEE_CELL,
	TRANSACTION_ROW,
} from "@lib/actual-dom";

const UPCOMING_ATTR = "data-abt-upcoming";

// Marks rows only when their state changes; CSS colours them, so a row Actual reuses for
// another transaction loses the colour with the mark.
function markUpcomingRows() {
	for (const row of document.querySelectorAll(TRANSACTION_ROW)) {
		const upcoming =
			row.querySelector(CATEGORY_CELL)?.firstElementChild?.textContent === "Upcoming";
		if (upcoming !== row.hasAttribute(UPCOMING_ATTR)) {
			row.toggleAttribute(UPCOMING_ATTR, upcoming);
		}
	}
}

function cleanup() {
	for (const row of document.querySelectorAll(`[${UPCOMING_ATTR}]`)) {
		row.removeAttribute(UPCOMING_ATTR);
	}
}

export const colorTransactions = defineSetting({
	type: "checkbox",
	label: "Color transactions",
	description: "Colors payments, deposits and upcoming transactions.",
	group: "Transactions",
	icon: "palette",
	preview: ColorTransactionsPreview,
	context: {
		key: "actual-amountcolors",
		defaultValue: true,
	},
	css: () => `
		*${CREDIT_CELL} {
			color: var(--color-numberPositive) !important;
		}
		*${DEBIT_CELL} {
			color: var(--color-numberNegative) !important;
		}
		[${UPCOMING_ATTR}] :is(${DATE_CELL}, ${ACCOUNT_CELL}, ${PAYEE_CELL}, ${NOTES_CELL}) {
			color: var(--ctp-peach, var(--color-warningText));
		}
	`,
	init: () => {
		const unwatch = watchDom(markUpcomingRows);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
