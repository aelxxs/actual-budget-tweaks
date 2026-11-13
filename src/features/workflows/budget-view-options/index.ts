import { icon } from "@lib/utilities/icons";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { openBudgetSettings } from "./settings";
import { BUDGET_TOTALS } from "@lib/actual-dom";

const GROUP_CLASS = "abt-view-options";
const HEAD = `${BUDGET_TOTALS} > div:first-of-type`;

const CSS = `
	.${GROUP_CLASS} {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-right: 6px;
	}
	.${GROUP_CLASS} > button {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 3px;
		color: currentColor;
		opacity: 0.7;
		cursor: pointer;
		border-radius: var(--abt-radius-sm);
		transition: opacity 0.12s ease, background 0.12s ease;
	}
	.${GROUP_CLASS} > button:hover {
		opacity: 1;
		background: color-mix(in srgb, currentColor 12%, transparent);
	}
	/* Actual's column-width toggle joins these icons instead of holding space before the title,
	   keeping its own hover-only fade. */
	${HEAD} > button:first-of-type,
	${HEAD} > .${GROUP_CLASS},
	${HEAD} > button:last-of-type {
		order: 1;
	}
	${HEAD} > button:first-of-type {
		margin: 0 2px 0 0 !important;
		padding: 5px !important;
		border-radius: var(--abt-radius-sm);
		transition: opacity 0.12s ease, background 0.12s ease;
	}
	${HEAD} > button:first-of-type:hover {
		background: color-mix(in srgb, currentColor 12%, transparent);
	}
	/* The title starts in line with the group rows' arrows. */
	${HEAD} > div:first-of-type {
		margin-left: var(--abt-space-3);
	}
`;

let group: HTMLElement | null = null;

/** The sliders button, which opens Budget settings. */
function injectControl(): void {
	const bar = document.querySelector<HTMLElement>(BUDGET_TOTALS)
		?.firstElementChild as HTMLElement | null;
	const menuBtn = bar?.lastElementChild as HTMLElement | null;
	if (!bar || !menuBtn || (group && bar.contains(group))) {
		return;
	}

	const wrap = document.createElement("span");
	wrap.className = GROUP_CLASS;
	wrap.setAttribute("role", "group");
	wrap.setAttribute("aria-label", "Budget view");

	const settings = document.createElement("button");
	settings.type = "button";
	settings.title = "Budget settings";
	settings.setAttribute("aria-label", "Budget settings");
	settings.innerHTML = icon("sliders", { size: 15 });
	settings.addEventListener("click", openBudgetSettings);

	wrap.append(settings);
	bar.insertBefore(wrap, menuBtn);
	group = wrap;
}

function sync(): void {
	if (!matchesPage(Page.Budget)) {
		group?.remove();
		group = null;
		return;
	}
	injectControl();
}

/** Budget table header control: a button that opens Budget settings. */
export const budgetViewOptions = {
	type: "core" as const,
	init: () => {
		applyGlobalCSS(CSS, "budget-view-options");
		watchDom(sync);
	},
};
