import { applySettingChange } from "@features/runtime";
import type { CheckboxSetting } from "@features/types";
import { categoryTemplateInsights } from "@features/workflows/category-template-insights";
import { icon } from "@lib/icons";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
import { getValue } from "@lib/utilities/store";
import { mount, unmount } from "svelte";
import ViewOptions from "./ViewOptions.svelte";

const GROUP_CLASS = "abt-view-options";
const POPOVER_CLASS = "abt-view-options-popover";

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
	.${GROUP_CLASS} > button:hover,
	.${GROUP_CLASS} > button[aria-expanded="true"] {
		opacity: 1;
		background: color-mix(in srgb, currentColor 12%, transparent);
	}
	.${POPOVER_CLASS} {
		position: fixed;
		z-index: 10000;
	}
`;

const insightsSetting: CheckboxSetting<any> = categoryTemplateInsights;
const INSIGHTS_KEY = insightsSetting.context.key;

let group: HTMLElement | null = null;
let toggleBtn: HTMLButtonElement | null = null;
let moreBtn: HTMLButtonElement | null = null;
let insightsOn = categoryTemplateInsights.context.defaultValue;
let popover: { el: HTMLElement; instance: ReturnType<typeof mount>; stop: () => void } | null =
	null;

/** Bullseye toggles insight bars in one click; the sliders button opens View options. */
function injectControl(): void {
	const bar = document.querySelector<HTMLElement>('[data-testid="budget-totals"]')
		?.firstElementChild as HTMLElement | null;
	const menuBtn = bar?.lastElementChild as HTMLElement | null;
	if (!bar || !menuBtn || (group && bar.contains(group))) return;

	const wrap = document.createElement("span");
	wrap.className = GROUP_CLASS;
	wrap.setAttribute("role", "group");
	wrap.setAttribute("aria-label", "Budget view");

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.addEventListener("click", () => {
		applySettingChange(insightsSetting, !insightsOn);
	});

	const more = document.createElement("button");
	more.type = "button";
	more.title = "View options";
	more.setAttribute("aria-label", "View options");
	more.setAttribute("aria-expanded", "false");
	more.innerHTML = icon("sliders", { size: 15 });
	more.addEventListener("click", (e) => {
		e.stopPropagation();
		if (popover) closePopover();
		else openPopover();
	});

	wrap.append(toggle, more);
	bar.insertBefore(wrap, menuBtn);
	group = wrap;
	toggleBtn = toggle;
	moreBtn = more;
	renderToggle();
}

function renderToggle(): void {
	if (!toggleBtn) return;
	const label = insightsOn ? "Hide template insight bars" : "Show template insight bars";
	toggleBtn.title = label;
	toggleBtn.setAttribute("aria-label", label);
	toggleBtn.setAttribute("aria-pressed", String(insightsOn));
	toggleBtn.innerHTML = icon(insightsOn ? "target" : "targetOff", { size: 15 });
}

function openPopover(): void {
	if (!group || !moreBtn) return;
	const el = document.createElement("div");
	el.className = POPOVER_CLASS;
	document.body.appendChild(el);
	const instance = mount(ViewOptions, { target: el });
	positionPopover(el, group, { align: "right" });

	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Escape") closePopover();
	};
	document.addEventListener("keydown", onKey);
	const stopOutside = onOutsideClick([el, moreBtn], closePopover);

	moreBtn.setAttribute("aria-expanded", "true");
	popover = {
		el,
		instance,
		stop: () => {
			stopOutside();
			document.removeEventListener("keydown", onKey);
		},
	};
}

function closePopover(): void {
	if (!popover) return;
	popover.stop();
	unmount(popover.instance);
	popover.el.remove();
	popover = null;
	moreBtn?.setAttribute("aria-expanded", "false");
}

function sync(): void {
	if (!matchesPage(Page.Budget)) {
		closePopover();
		group?.remove();
		group = toggleBtn = moreBtn = null;
		return;
	}
	injectControl();
}

/** Budget table header control: one-click insight bars toggle plus a View options popover. */
export const budgetViewOptions = {
	type: "core" as const,
	init: async () => {
		applyGlobalCSS(CSS, "budget-view-options");
		insightsOn = Boolean(await getValue(INSIGHTS_KEY, insightsOn));
		// Follows changes from the popover and the settings page too.
		browser.storage.onChanged.addListener((changes, area) => {
			if (area !== "local" || !(`local:${INSIGHTS_KEY}` in changes)) return;
			insightsOn = Boolean(changes[`local:${INSIGHTS_KEY}`].newValue);
			renderToggle();
		});
		watchDom(sync);
	},
};
