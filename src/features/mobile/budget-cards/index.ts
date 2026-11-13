import { defineSetting } from "@features/types";
import { watchDom } from "@lib/dom/dom-watcher";
import {
	ACCOUNT_NAME,
	LISTBOX,
	MOBILE_ACCOUNT_ROW,
	MOBILE_BUDGET_GROUPS,
	MOBILE_BUDGET_HEADER,
	MOBILE_CATEGORY_ROW,
	MOBILE_GROUP_ROW,
	MOBILE_HEADING_NAME,
} from "@lib/actual-dom";

const CARD_ATTR = "data-abt-m-card";
const GROUP_ROW = `${MOBILE_BUDGET_GROUPS} ${MOBILE_GROUP_ROW}`;
// Accounts: each list (a listbox of account rows) follows its heading button.
const ACCOUNT_LIST_ATTR = "data-abt-m-account-list";
const ACCOUNT_HEAD_ATTR = "data-abt-m-account-head";

/** Each group's card: the header row sits in the card's clipping wrapper, inside the card. */
function markBudgetCards() {
	for (const row of document.querySelectorAll<HTMLElement>(GROUP_ROW)) {
		const card = row.parentElement?.parentElement;
		if (!card || card.hasAttribute(CARD_ATTR)) {
			continue;
		}
		// Only Actual's Card clips its rows; a dragged header's preview has no such wrapper.
		if (getComputedStyle(row.parentElement!).overflow === "hidden") {
			card.setAttribute(CARD_ATTR, "");
		}
	}
}

/** Joins each accounts heading to the list under it, as the budget's group cards do. */
function markAccountCards() {
	const list = document.querySelector(MOBILE_ACCOUNT_ROW)?.closest(LISTBOX);
	const page = list?.parentElement;
	if (!page) {
		return;
	}
	// A heading heads the next list unless another heading comes first; other elements can sit
	// between the two.
	let heading: Element | null = null;
	for (const el of page.children) {
		if (el.tagName === "BUTTON" && el.querySelector(MOBILE_HEADING_NAME)) {
			heading?.setAttribute(ACCOUNT_HEAD_ATTR, "alone");
			heading = el;
		} else if (el.getAttribute("role") === "listbox" && el.querySelector(MOBILE_ACCOUNT_ROW)) {
			el.setAttribute(ACCOUNT_LIST_ATTR, "");
			heading?.setAttribute(ACCOUNT_HEAD_ATTR, "attached");
			heading = null;
		}
	}
	heading?.setAttribute(ACCOUNT_HEAD_ATTR, "alone");
}

/** Cards: inset and rounded, like iOS's grouped lists. */
const CARDS_CSS = `
		[${CARD_ATTR}] {
			margin: var(--abt-space-3) var(--abt-space-4) !important;
			border: 1px solid var(--color-tableBorder) !important;
			border-radius: var(--abt-radius-lg) !important;
			box-shadow: none !important;
			/* Clips the last row's bottom border, which doubled up with the card's own. */
			overflow: hidden !important;
		}

		[${CARD_ATTR}] > div {
			margin-bottom: -1px;
			border-radius: 0 !important;
		}

		/* The To Budget / Budgeted / Spent / Balance bar stays put while the cards scroll under it,
		   so it's flush with a hairline rather than a card. Side padding puts its columns over the
		   cards' (12px margin, 1px border, 5px row padding). */
		${MOBILE_BUDGET_HEADER} {
			padding: var(--abt-space-4) 18px !important;
			border-bottom: 1px solid var(--color-tableBorder);
			background: var(--color-mobilePageBackground) !important;
		}

		/* Report widgets: the grid places them, so only their shape changes. */
		.react-grid-item {
			overflow: hidden;
			border: 1px solid var(--color-tableBorder);
			border-radius: var(--abt-radius-lg);
		}

		/* Account headings as the card's header row, like a budget group's. */
		[${ACCOUNT_HEAD_ATTR}] {
			box-sizing: border-box;
			width: auto !important;
			margin: var(--abt-space-3) var(--abt-space-4) 0 !important;
			padding: 0 var(--abt-space-4) !important;
			border: 1px solid var(--color-tableBorder) !important;
			border-radius: var(--abt-radius-lg) var(--abt-radius-lg) 0 0 !important;
			background: var(--color-budgetHeaderCurrentMonth) !important;
			color: var(--color-pageText) !important;
			font-weight: 600;
		}

		[${ACCOUNT_HEAD_ATTR}="alone"] {
			margin-bottom: var(--abt-space-3) !important;
			border-radius: var(--abt-radius-lg) !important;
		}

		[${ACCOUNT_HEAD_ATTR}] ${MOBILE_HEADING_NAME} {
			font-size: var(--abt-text-xl) !important;
		}

		[${ACCOUNT_LIST_ATTR}] {
			margin: 0 var(--abt-space-4) var(--abt-space-3) !important;
			border-top: 0 !important;
			border-radius: 0 0 var(--abt-radius-lg) var(--abt-radius-lg) !important;
		}

		[${ACCOUNT_LIST_ATTR}] ${MOBILE_ACCOUNT_ROW} {
			padding-left: var(--abt-space-4) !important;
			padding-right: var(--abt-space-4) !important;
		}

		[${ACCOUNT_LIST_ATTR}] ${ACCOUNT_NAME} {
			font-size: var(--abt-text-xl) !important;
			font-weight: 500 !important;
		}
`;

/** Compact: on top of the cards' rules, sections run the full width with square edges. */
const COMPACT_CSS = `
	/* Groups as full-width sections between hairlines, with rows edge to edge. */
	[${CARD_ATTR}] {
		margin: 0 0 var(--abt-space-3) !important;
		border-width: 1px 0 !important;
		border-radius: 0 !important;
	}

	[${CARD_ATTR}] ${MOBILE_GROUP_ROW},
	[${CARD_ATTR}] ${MOBILE_CATEGORY_ROW} > div {
		padding-left: var(--abt-space-4) !important;
		padding-right: var(--abt-space-4) !important;
	}

	${MOBILE_BUDGET_HEADER} {
		padding: var(--abt-space-4) !important;
	}

	[${ACCOUNT_HEAD_ATTR}] {
		margin: var(--abt-space-3) 0 0 !important;
		border-width: 1px 0 !important;
		border-radius: 0 !important;
	}

	[${ACCOUNT_LIST_ATTR}] {
		margin: 0 0 var(--abt-space-3) !important;
		border-width: 0 0 1px !important;
		border-radius: 0 !important;
	}
`;

export const mobileBudgetCards = defineSetting({
	type: "select",
	label: "Cards",
	description: "Shows budget groups, accounts and reports as rounded cards or flush sections.",
	group: "Mobile",
	icon: "layers",
	platform: "mobile",
	context: {
		key: "mobile-cards",
		defaultValue: "off",
	},
	options: [
		{ value: "off", label: "Off" },
		{ value: "cards", label: "Cards" },
		{ value: "compact", label: "Compact" },
	],
	css: (ctx) =>
		ctx.value === "off" ? "" : ctx.value === "compact" ? CARDS_CSS + COMPACT_CSS : CARDS_CSS,
	init: (ctx) => {
		if (ctx.value === "off") {
			return;
		}
		const stop = watchDom(() => {
			if (document.querySelector(MOBILE_BUDGET_GROUPS)) {
				markBudgetCards();
			}
			if (document.querySelector(MOBILE_ACCOUNT_ROW)) {
				markAccountCards();
			}
		});
		return () => {
			stop();
			for (const attr of [CARD_ATTR, ACCOUNT_LIST_ATTR, ACCOUNT_HEAD_ATTR]) {
				for (const el of document.querySelectorAll(`[${attr}]`)) {
					el.removeAttribute(attr);
				}
			}
		};
	},
});
