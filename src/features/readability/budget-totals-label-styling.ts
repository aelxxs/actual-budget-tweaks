import { BUDGET_TOTALS, BUDGET_TOTAL_LABELS } from "@lib/actual-dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";

const LABEL_ATTR = "data-abt-budget-total-label";
const CATEGORY_ATTR = "data-abt-budget-category-label";

export const TOTALS_LABEL_CSS = `
	[${LABEL_ATTR}] {
		color: var(--color-tableHeaderText);
		font-size: var(--abt-text-xs);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-bottom: 0.25rem;
	}
	[${CATEGORY_ATTR}] {
		color: var(--color-tableHeaderText);
		font-size: var(--abt-text-xs);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
`;

function styleLabels() {
	if (!matchesPage(Page.Budget)) {
		return;
	}

	// The category column's title is its first div; Actual's toggle and menu are buttons.
	const category = document
		.querySelector(BUDGET_TOTALS)
		?.firstElementChild?.querySelector(":scope > div");
	if (category && !category.hasAttribute(CATEGORY_ATTR)) {
		category.setAttribute(CATEGORY_ATTR, "");
	}

	for (const value of document.querySelectorAll<HTMLElement>(BUDGET_TOTAL_LABELS)) {
		const label = value.previousElementSibling;
		if (label instanceof HTMLElement && label.tagName === "SPAN") {
			label.setAttribute(LABEL_ATTR, "1");
		}
	}
}

function cleanup() {
	document.querySelectorAll(`[${LABEL_ATTR}]`).forEach((el) => el.removeAttribute(LABEL_ATTR));
	document
		.querySelectorAll(`[${CATEGORY_ATTR}]`)
		.forEach((el) => el.removeAttribute(CATEGORY_ATTR));
}

/** Mutes and uppercases the budget table header's labels, like ABT's other headers; returns its cleanup. */
export function startTotalsLabels(): () => void {
	const unwatch = watchDom(styleLabels);
	return () => {
		unwatch();
		cleanup();
	};
}
