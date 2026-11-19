import { defineSetting } from "@features/types";
import { watchDom } from "@lib/dom/dom-watcher";
import ColorAmountsPreview from "./previews/ColorAmounts.svelte";
import {
	ACCOUNT_CELL,
	BALANCE_CELL,
	BUDGET_SCROLLER,
	CATEGORY_CELL,
	CREDIT_CELL,
	DATE_CELL,
	DEBIT_CELL,
	LEFTOVER_CELL,
	NEGATIVE_BALANCE_CELL,
	NOTES_CELL,
	PAYEE_CELL,
	SHEET_BALANCES,
	TRANSACTION_ROW,
} from "@lib/actual-dom";

const UPCOMING_ATTR = "data-abt-upcoming";
const NEGATIVE_ATTR = "data-abt-negative";
const ZERO_ATTR = "data-abt-zero";
const CATEGORY_BALANCES = `${BUDGET_SCROLLER} span${LEFTOVER_CELL}`;
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
	// No non-zero digit: nothing left, which isn't good or bad, whatever the goal says.
	for (const el of document.querySelectorAll(CATEGORY_BALANCES)) {
		const zero = !/[1-9]/.test(el.textContent ?? "");
		if (zero !== el.hasAttribute(ZERO_ATTR)) {
			el.toggleAttribute(ZERO_ATTR, zero);
		}
	}
}

function cleanup() {
	for (const el of document.querySelectorAll(
		`[${UPCOMING_ATTR}], [${NEGATIVE_ATTR}], [${ZERO_ATTR}]`,
	)) {
		el.removeAttribute(UPCOMING_ATTR);
		el.removeAttribute(NEGATIVE_ATTR);
		el.removeAttribute(ZERO_ATTR);
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
	/* Over Actual's inline goal colour, which turns a met goal's zero green. */
	[${ZERO_ATTR}] {
		color: var(--color-budgetNumberZero) !important;
	}
	/* Heavier than Actual's 400 (Inter is variable), so the colour carries; thin strokes read as grey on light themes. */
	${CATEGORY_BALANCES}:not([${ZERO_ATTR}]) {
		font-weight: 450 !important;
	}
`;

const POSITIVES_CSS = `
	*${CREDIT_CELL} {
		color: var(--color-numberPositive) !important;
	}
	/* Not the budget's group totals: a group's balance isn't money coming in. */
	${BALANCE_CELL}:not(${NEGATIVE_BALANCE_CELL}):not(${BUDGET_SCROLLER} *) {
		color: var(--color-noticeTextLight);
	}
`;

export const colorAmounts = defineSetting({
	type: "select",
	label: "Color amounts",
	description:
		"Colors amounts by sign in transactions, balances and budget groups. Zero stays plain.",
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
		{ value: "all", label: "All", description: "Red for money out, green for money in." },
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
