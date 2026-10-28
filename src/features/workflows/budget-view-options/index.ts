import { applySettingChange } from "@features/runtime";
import type { CheckboxSetting } from "@features/types";
import { categoryTemplateInsights } from "@features/workflows/category-template-insights";
import { icon } from "@lib/utilities/icons";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { getValue } from "@lib/utilities/store";
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
	/* Actual's column-width toggle joins these icons, always shown, instead of holding space
	   before the title; its hover-only fade is overridden. */
	${HEAD} > button:first-of-type,
	${HEAD} > .${GROUP_CLASS},
	${HEAD} > button:last-of-type {
		order: 1;
	}
	${HEAD} > button:first-of-type {
		margin: 0 2px 0 0 !important;
		padding: 5px !important;
		opacity: 0.7 !important;
		border-radius: var(--abt-radius-sm);
		transition: opacity 0.12s ease, background 0.12s ease;
	}
	${HEAD} > button:first-of-type:hover {
		opacity: 1 !important;
		background: color-mix(in srgb, currentColor 12%, transparent);
	}
	/* The title starts in line with the group rows' arrows. */
	${HEAD} > div:first-of-type {
		margin-left: var(--abt-space-3);
	}
`;

const insightsSetting: CheckboxSetting<any> = categoryTemplateInsights;
const INSIGHTS_KEY = insightsSetting.context.key;

let group: HTMLElement | null = null;
let toggleBtn: HTMLButtonElement | null = null;
let insightsOn = categoryTemplateInsights.context.defaultValue;

/** Bullseye toggles insight bars in one click; the sliders button opens Budget settings. */
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

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.addEventListener("click", () => {
		applySettingChange(insightsSetting, !insightsOn);
	});

	const settings = document.createElement("button");
	settings.type = "button";
	settings.title = "Budget settings";
	settings.setAttribute("aria-label", "Budget settings");
	settings.innerHTML = icon("sliders", { size: 15 });
	settings.addEventListener("click", openBudgetSettings);

	wrap.append(toggle, settings);
	bar.insertBefore(wrap, menuBtn);
	group = wrap;
	toggleBtn = toggle;
	renderToggle();
}

function renderToggle(): void {
	if (!toggleBtn) {
		return;
	}
	const label = insightsOn ? "Hide template insight bars" : "Show template insight bars";
	toggleBtn.title = label;
	toggleBtn.setAttribute("aria-label", label);
	toggleBtn.setAttribute("aria-pressed", String(insightsOn));
	toggleBtn.innerHTML = icon(insightsOn ? "target" : "targetOff", { size: 15 });
}

function sync(): void {
	if (!matchesPage(Page.Budget)) {
		group?.remove();
		group = toggleBtn = null;
		return;
	}
	injectControl();
}

/** Budget table header control: one-click insight bars toggle plus a Budget settings button. */
export const budgetViewOptions = {
	type: "core" as const,
	init: async () => {
		applyGlobalCSS(CSS, "budget-view-options");
		insightsOn = Boolean(await getValue(INSIGHTS_KEY, insightsOn));
		// Follows changes from the settings dialog and page too.
		browser.storage.onChanged.addListener((changes, area) => {
			if (area !== "local" || !(`local:${INSIGHTS_KEY}` in changes)) {
				return;
			}
			insightsOn = Boolean(changes[`local:${INSIGHTS_KEY}`].newValue);
			renderToggle();
		});
		watchDom(sync);
	},
};
