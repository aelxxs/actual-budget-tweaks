import { sidepanel } from "@features/core/side-panel";
import { CONTENT_GRID, SIDEBAR_ATTR } from "@features/core/side-panel/api";
import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, clearOverlayPage, matchesPage, setOverlayPage } from "@lib/utilities/pages";
import { watchRoute } from "@lib/utilities/route-watcher";
import { mount, unmount } from "svelte";
import Calendar from "./Calendar.svelte";

const LINK_ATTR = "data-abt-calendar-link";
const CALENDAR_ATTR = "data-abt-calendar";

const CALENDAR_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="7" y="13" width="3" height="3" rx="0.5"/><rect x="14" y="13" width="3" height="3" rx="0.5"/></svg>`;

let calendarInstance: ReturnType<typeof mount> | null = null;
let calendarContainer: HTMLElement | null = null;
let hiddenChildren: { el: HTMLElement; style: string }[] = [];
let scrollLock: { el: HTMLElement; overflow: string } | null = null;

export function isCalendarOpen(): boolean {
	return matchesPage(Page.Calendar);
}

function updateActiveState(): void {
	const open = isCalendarOpen();
	const link = document.querySelector(`[${LINK_ATTR}]`) as HTMLElement;
	if (link) {
		link.setAttribute("data-active", String(open));
	}
	document.body.classList.toggle("abt-calendar-open", open);
}

/**
 * Exported so other features can trigger the same calendar overlay without
 * duplicating its DOM-manipulation logic — the experimental sidebar's
 * PrimaryNav uses this instead of cloning a native sidebar link (this
 * feature's own trigger mechanism), since it isn't a real `<a href>` element.
 */
export function openCalendar(): void {
	if (calendarContainer) return;

	const target = document.querySelector(CONTENT_GRID) as HTMLElement;
	if (!target) return;

	const columns = Array.from(target.children).filter(
		(child) => !child.hasAttribute(SIDEBAR_ATTR),
	) as HTMLElement[];
	const lastChild = columns[columns.length - 1];
	if (!lastChild) return;

	// Hidden in place rather than display: none, which makes Actual drop the budget table and
	// rebuild it (blank for a moment) on the way back. The calendar covers the column instead.
	// Widths are held from before the side panel goes, so its return doesn't reflow the page.
	const children = Array.from(lastChild.children) as HTMLElement[];
	const widths = children.map((child) => child.getBoundingClientRect().width);
	// Dismissed, not closed, so a panel left open on the page comes back with it.
	sidepanel.dismiss();
	hiddenChildren = [];
	children.forEach((child, i) => {
		hiddenChildren.push({ el: child, style: child.getAttribute("style") ?? "" });
		Object.assign(child.style, {
			visibility: "hidden",
			boxSizing: "border-box",
			width: `${widths[i]}px`,
		});
	});
	// Also hide siblings of lastChild (e.g. Plan button) but not the nav header
	for (const sibling of columns) {
		if (sibling === lastChild || sibling === target.firstElementChild) continue;
		hiddenChildren.push({ el: sibling, style: sibling.getAttribute("style") ?? "" });
		sibling.style.display = "none";
	}

	// The hidden page still overflows on long pages (e.g. Reports), and the grid is what scrolls;
	// left scrolled, the calendar would open part-way off screen.
	scrollLock = { el: target, overflow: target.style.overflowY };
	target.scrollTop = 0;
	target.style.overflowY = "hidden";

	calendarContainer = document.createElement("div");
	calendarContainer.setAttribute(CALENDAR_ATTR, "1");
	calendarContainer.style.cssText =
		"display: flex; position: absolute; inset: 0; z-index: 1; overflow: hidden;";
	lastChild.appendChild(calendarContainer);
	// No URL of its own: Actual's router would redirect it, and history entries it doesn't
	// know about confuse its back navigation. ABT's page checks see the calendar instead.
	setOverlayPage(Page.Calendar, calendarContainer);

	calendarInstance = mount(Calendar, {
		target: calendarContainer,
		props: { onClose: closeCalendar },
	});

	updateActiveState();
}

export function closeCalendar(): void {
	if (!calendarContainer) return;

	sidepanel.dismiss();

	unmount(calendarInstance!);
	calendarInstance = null;
	calendarContainer.remove();
	calendarContainer = null;

	for (const { el, style } of hiddenChildren) {
		if (el.parentElement) el.setAttribute("style", style);
	}
	hiddenChildren = [];

	if (scrollLock) {
		scrollLock.el.style.overflowY = scrollLock.overflow;
		scrollLock = null;
	}

	clearOverlayPage();

	updateActiveState();
}

function injectSidebarLink(): void {
	if (document.querySelector(`[${LINK_ATTR}]`)) return;

	const schedulesLink = document.querySelector('a[href="/schedules"]') as HTMLAnchorElement;
	if (!schedulesLink) return;

	const wrapper = schedulesLink.parentElement;
	if (!wrapper?.parentElement) return;

	const clone = wrapper.cloneNode(true) as HTMLElement;
	const link = clone.querySelector("a") as HTMLAnchorElement;
	if (!link) return;

	link.setAttribute(LINK_ATTR, "1");
	link.setAttribute("data-active", "false");
	link.href = "/calendar";
	link.removeAttribute("aria-current");

	const svg = link.querySelector("svg");
	if (svg) {
		const tmp = document.createElement("div");
		tmp.innerHTML = CALENDAR_ICON;
		svg.replaceWith(tmp.firstElementChild!);
	}

	const textNodes = link.querySelectorAll("span, div");
	for (let i = textNodes.length - 1; i >= 0; i--) {
		const node = textNodes[i];
		if (node.textContent?.trim() === "Schedules" && node.children.length === 0) {
			node.textContent = "Calendar";
			break;
		}
	}

	link.addEventListener("click", (e) => {
		e.preventDefault();
		if (!calendarContainer) {
			openCalendar();
		}
	});

	wrapper.parentElement.insertBefore(clone, wrapper.nextSibling);

	attachCloseListeners();
}

const CLOSE_ATTR = "data-abt-cal-close";

function attachCloseListeners(): void {
	const links = document.querySelectorAll(`a[href^="/"]:not([${LINK_ATTR}]):not([${CLOSE_ATTR}])`);
	for (const link of links) {
		link.setAttribute(CLOSE_ATTR, "1");
		link.addEventListener("click", () => {
			if (calendarContainer) {
				closeCalendar();
			}
		});
	}
}

function cleanup(unwatch: () => void, stopWatchingRoute: () => void): void {
	closeCalendar();
	document.body.classList.remove("abt-calendar-open");
	document.querySelectorAll(`[${LINK_ATTR}]`).forEach((el) => {
		const parent = el.parentElement;
		if (parent && !parent.querySelector('a[href="/schedules"]')) {
			parent.remove();
		} else {
			el.remove();
		}
	});
	unwatch();
	stopWatchingRoute();
}

export const spendingCalendar = defineSetting({
	type: "checkbox",
	label: "Spending Calendar",
	description: "A calendar view of daily spending, added to the sidebar.",
	icon: "calendar",
	context: {
		key: "spending-calendar-enabled",
		defaultValue: false,
	},
	init: () => {
		let injectedOnce = false;

		const unwatch = watchDom(() => {
			if (
				!document.querySelector(`[${LINK_ATTR}]`) &&
				document.querySelector('a[href="/schedules"]')
			) {
				if (!injectedOnce) {
					injectedOnce = true;
					injectSidebarLink();
				} else {
					requestAnimationFrame(() => injectSidebarLink());
				}
			}
			// Actual changed the route without telling this world (a shortcut, say).
			if (calendarContainer && !isCalendarOpen()) closeCalendar();
			attachCloseListeners();
			updateActiveState();
		});

		// The calendar has no route, so any route change means Actual moved to another page.
		const stopWatchingRoute = watchRoute(() => {
			if (calendarContainer) closeCalendar();
			updateActiveState();
		});

		return () => cleanup(unwatch, stopWatchingRoute);
	},
});
