import { CONTENT_GRID } from "@features/core/side-panel/api";
import { dockInsightsTrigger } from "@features/workflows/template-plan";
import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { mount, unmount } from "svelte";
import MonthHeader from "./MonthHeader.svelte";
import {
	countMonthIcons,
	findMonthCountSelector,
	onNativeFallback,
	readShownMonths,
} from "./native";
import { budgetNav } from "./state.svelte";

const NATIVE_HEADER_ATTR = "data-abt-native-month-header";
const NATIVE_COUNT_ATTR = "data-abt-native-month-count";
const FULL_WIDTH_ATTR = "data-abt-full-width";

let host: HTMLElement | null = null;
let instance: ReturnType<typeof mount> | null = null;
let countSelector: HTMLElement | null = null;
/** Set when the header couldn't drive Actual; Actual's own controls stay until the setting restarts. */
let fellBack = false;

function unmountHeader(): void {
	if (instance) unmount(instance);
	instance = null;
	host?.remove();
	host = null;
}

function restoreNative(): void {
	for (const attr of [NATIVE_HEADER_ATTR, NATIVE_COUNT_ATTR, FULL_WIDTH_ATTR]) {
		for (const el of document.querySelectorAll(`[${attr}]`)) el.removeAttribute(attr);
	}
	countSelector = null;
}

/**
 * Where the header goes: in the content column, above the budget page, so it spans
 * the column instead of the table's width-capped, auto-sized box.
 */
function findPageSlot(table: HTMLElement): { column: HTMLElement; page: HTMLElement } | null {
	let page = table;
	while (
		page.parentElement?.parentElement &&
		!page.parentElement.parentElement.matches(CONTENT_GRID)
	) {
		page = page.parentElement;
	}
	const column = page.parentElement;
	return column?.parentElement?.matches(CONTENT_GRID) ? { column, page } : null;
}

const sameMonths = (a: string[], b: string[]) =>
	a.length === b.length && a.every((m, i) => m === b[i]);

function sync(): void {
	if (!matchesPage(Page.Budget)) {
		if (host) unmountHeader();
		return;
	}
	if (fellBack) return;
	const table = document.querySelector<HTMLElement>('[data-testid="budget-table"]');
	const parent = table?.parentElement;
	if (!table || !parent) return;
	// Actual's own header stays mounted (hidden) as the source of truth for the shown months.
	const native = [...parent.children].find((el) =>
		el.querySelector('[data-testid="selected-budget-month"]'),
	);
	if (!native) return;
	native.setAttribute(NATIVE_HEADER_ATTR, "");
	parent.setAttribute(FULL_WIDTH_ATTR, "");

	if (!countSelector?.isConnected) {
		countSelector = findMonthCountSelector();
		countSelector?.setAttribute(NATIVE_COUNT_ATTR, "");
	}

	const months = readShownMonths(native);
	if (!sameMonths(months, budgetNav.months)) budgetNav.months = months;
	const displayMax = countSelector ? countMonthIcons(countSelector) : 1;
	if (displayMax !== budgetNav.displayMax) budgetNav.displayMax = displayMax;

	if (host?.isConnected && host.nextElementSibling?.contains(table)) return;
	const slot = findPageSlot(table);
	if (!slot) return;
	unmountHeader();
	host = document.createElement("div");
	// Out to the column's edges, where the calendar's header sits (it zeroes this padding).
	const pad = getComputedStyle(slot.column);
	host.style.cssText = `flex-shrink: 0; margin: -${pad.paddingTop} -${pad.paddingRight} 0 -${pad.paddingLeft};`;
	slot.column.insertBefore(host, slot.page);
	instance = mount(MonthHeader, { target: host });
}

export const budgetMonthHeader = defineSetting({
	type: "checkbox",
	label: "Month header (experimental)",
	description:
		"Replace the budget page's month strip with a header: a month picker, months-shown control, and Today.",
	icon: "calendar",
	group: "Budget",
	context: {
		key: "budget-month-header",
		defaultValue: false,
	},
	css: () => `
		[${NATIVE_HEADER_ATTR}], [${NATIVE_COUNT_ATTR}] { display: none !important; }

		/* Actual caps the table at its columns' natural width (500px a month); fill the page instead. */
		[${FULL_WIDTH_ATTR}] { max-width: none !important; }
	`,
	init: () => {
		fellBack = false;
		// Claimed now, not when the header mounts: Insights would otherwise draw its floating
		// button until the budget table renders.
		let undock: (() => void) | null = dockInsightsTrigger();
		const release = () => {
			undock?.();
			undock = null;
		};
		const stopFallback = onNativeFallback(() => {
			fellBack = true;
			release();
			unmountHeader();
			restoreNative();
		});
		const unwatch = watchDom(sync);
		return () => {
			release();
			stopFallback();
			unwatch();
			unmountHeader();
			restoreNative();
		};
	},
});
