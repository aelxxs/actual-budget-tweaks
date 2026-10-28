import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { BUDGET_TABLE, CATEGORY_NAME, ROW } from "@lib/actual-dom";

const HOVER_ATTR = "data-abt-row-hover";

// Every cell paints its own background, so the tint is an overlay on the row instead.
const CSS = `
	[${HOVER_ATTR}] {
		position: relative;
	}
	[${HOVER_ATTR}]:hover::after {
		content: "";
		position: absolute;
		inset: 0;
		background: var(--abt-ink-2);
		pointer-events: none;
	}
`;

function markRows() {
	if (!matchesPage(Page.Budget)) {
		return;
	}
	for (const row of document.querySelectorAll(`${BUDGET_TABLE} ${ROW}`)) {
		if (!row.hasAttribute(HOVER_ATTR) && row.querySelector(CATEGORY_NAME)) {
			row.setAttribute(HOVER_ATTR, "");
		}
	}
}

export const budgetRowHover = defineSetting({
	type: "checkbox",
	label: "Highlight Hovered Budget Row",
	description: "Tint the category row under the cursor, so its numbers are easy to follow across.",
	group: "Budget",
	icon: "rows",
	context: {
		key: "budget-row-hover",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(markRows);
		return () => {
			unwatch();
			for (const el of document.querySelectorAll(`[${HOVER_ATTR}]`)) {
				el.removeAttribute(HOVER_ATTR);
			}
		};
	},
});
