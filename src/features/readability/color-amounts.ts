import { defineSetting } from "@features/types";
import { watchDom } from "@lib/dom/dom-watcher";
import ColorAmountsPreview from "./previews/ColorAmounts.svelte";
import {
	ACCOUNT_CELL,
	BALANCE_CELL,
	CATEGORY_CELL,
	CREDIT_CELL,
	DATE_CELL,
	DEBIT_CELL,
	NEGATIVE_BALANCE_CELL,
	NOTES_CELL,
	PAYEE_CELL,
	SHEET_BALANCES,
	TRANSACTION_ROW,
} from "@lib/actual-dom";

export type AmountColors = "off" | "negatives" | "all";

const UPCOMING_ATTR = "data-abt-upcoming";
const NEGATIVE_ATTR = "data-abt-negative";
// Hyphen-minus or Unicode minus, then any currency symbol or space before a digit.
const MINUS = /[-−][^\d]*\d/;

// Marks rows and balances only when their state changes, so a row Actual reuses loses the mark.
function mark() {
	for (const row of document.querySelectorAll(TRANSACTION_ROW)) {
		const upcoming =
			row.querySelector(CATEGORY_CELL)?.firstElementChild?.textContent === "Upcoming";
		if (upcoming !== row.hasAttribute(UPCOMING_ATTR)) {
			row.toggleAttribute(UPCOMING_ATTR, upcoming);
		}
	}
	for (const el of document.querySelectorAll(SHEET_BALANCES)) {
		const negative = MINUS.test(el.textContent ?? "");
		if (negative !== el.hasAttribute(NEGATIVE_ATTR)) {
			el.toggleAttribute(NEGATIVE_ATTR, negative);
		}
	}
}

function cleanup() {
	for (const el of document.querySelectorAll(`[${UPCOMING_ATTR}], [${NEGATIVE_ATTR}]`)) {
		el.removeAttribute(UPCOMING_ATTR);
		el.removeAttribute(NEGATIVE_ATTR);
	}
}

// Only group rows' balances take these colours; Actual colours category balances inline.

const NEGATIVES_CSS = `
	*${DEBIT_CELL} {
		color: var(--color-numberNegative) !important;
	}
	[${NEGATIVE_ATTR}] {
		color: var(--color-errorText);
	}
	${NEGATIVE_BALANCE_CELL} {
		color: var(--color-errorText);
		font-weight: bold;
	}
	[${UPCOMING_ATTR}] :is(${DATE_CELL}, ${ACCOUNT_CELL}, ${PAYEE_CELL}, ${NOTES_CELL}) {
		color: var(--ctp-peach, var(--color-warningText));
	}
`;

const POSITIVES_CSS = `
	*${CREDIT_CELL} {
		color: var(--color-numberPositive) !important;
	}
	${BALANCE_CELL}:not(${NEGATIVE_BALANCE_CELL}) {
		color: var(--color-noticeTextLight);
	}
`;

export const colorAmounts = defineSetting({
	type: "select",
	label: "Color amounts",
	description: "Colors amounts by sign in transactions, balances and budget groups.",
	group: "General",
	icon: "circleDollarSign",
	preview: ColorAmountsPreview,
	context: {
		key: "color-amounts",
		defaultValue: "all",
	},
	options: [
		{ value: "off", label: "Off" },
		{
			value: "negatives",
			label: "Negatives",
			description: "Money out and negative balances in red.",
		},
		{ value: "all", label: "All", description: "Money out in red and money in in green." },
	],
	segmented: true,
	css: ({ value }) =>
		value === "off" ? "" : value === "negatives" ? NEGATIVES_CSS : NEGATIVES_CSS + POSITIVES_CSS,
	init: ({ value }) => {
		if (value === "off") {
			return;
		}
		const unwatch = watchDom(mark);
		return () => {
			unwatch();
			cleanup();
		};
	},
});
