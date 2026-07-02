import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";

const LABEL_ATTR = "data-abt-budget-total-label";
const VALUE_SELECTOR =
	'[data-testid*="!total-budgeted"], [data-testid*="!total-spent"], [data-testid*="!total-leftover"]';

const CSS = `
	[${LABEL_ATTR}] {
		color: var(--color-pageTextSubdued);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-bottom: 0.25rem;
	}
`;

function styleLabels() {
	if (!matchesPage(Page.Budget)) return;

	for (const value of document.querySelectorAll<HTMLElement>(VALUE_SELECTOR)) {
		const label = value.previousElementSibling;
		if (label instanceof HTMLElement && label.tagName === "SPAN") {
			label.setAttribute(LABEL_ATTR, "1");
		}
	}
}

function cleanup() {
	document.querySelectorAll(`[${LABEL_ATTR}]`).forEach((el) => el.removeAttribute(LABEL_ATTR));
}

export const budgetTotalsLabelStyling = defineSetting({
	type: "checkbox",
	label: "Budget Totals Label Styling",
	description: "Mute and uppercase the Budgeted/Spent/Balance labels.",
	group: "Budget",
	icon: "layout",
	context: {
		key: "budget-totals-label-styling",
		defaultValue: true,
	},
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(styleLabels);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
