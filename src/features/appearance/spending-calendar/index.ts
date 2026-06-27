import { defineSetting } from "@features/types";
import { getValue, setValue } from "@lib/utilities/store";
import { mount, unmount } from "svelte";
import Calendar from "./Calendar.svelte";

const LINK_ATTR = "data-abt-calendar-link";
const CALENDAR_ATTR = "data-abt-calendar";

const CALENDAR_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="7" y="13" width="3" height="3" rx="0.5"/><rect x="14" y="13" width="3" height="3" rx="0.5"/></svg>`;

let observer: MutationObserver | null = null;
let calendarInstance: ReturnType<typeof mount> | null = null;
let calendarContainer: HTMLElement | null = null;
let hiddenChildren: { el: HTMLElement; display: string }[] = [];
let previousPath: string | null = null;

const CONTENT_CONTAINER = `div:has(> div:nth-child(4)):has([data-testid='budget-table'], [role='main'], [data-testid='account-name'])`;

function isCalendarOpen(): boolean {
	return window.location.pathname === "/calendar";
}

function updateActiveState(): void {
	const open = isCalendarOpen();
	const link = document.querySelector(`[${LINK_ATTR}]`) as HTMLElement;
	if (link) {
		link.setAttribute("data-active", String(open));
	}
	document.body.classList.toggle("abt-calendar-open", open);
}

function openCalendar(): void {
	if (calendarContainer) return;

	const target = document.querySelector(CONTENT_CONTAINER) as HTMLElement;
	if (!target) return;

	const lastChild = target.lastElementChild as HTMLElement;
	if (!lastChild) return;

	previousPath = window.location.pathname;
	history.pushState({}, "", "/calendar");

	// Hide the last child's content and any siblings after the first child (nav header)
	hiddenChildren = [];
	for (const child of Array.from(lastChild.children) as HTMLElement[]) {
		hiddenChildren.push({ el: child, display: child.style.display });
		child.style.display = "none";
	}
	// Also hide siblings of lastChild (e.g. Plan button) but not the nav header
	for (const sibling of Array.from(target.children) as HTMLElement[]) {
		if (sibling === lastChild || sibling === target.firstElementChild) continue;
		hiddenChildren.push({ el: sibling, display: sibling.style.display });
		sibling.style.display = "none";
	}

	lastChild.dataset.abtOrigPadding = lastChild.style.paddingTop;
	lastChild.style.padding = "0px";

	calendarContainer = document.createElement("div");
	calendarContainer.setAttribute(CALENDAR_ATTR, "1");
	calendarContainer.style.cssText = "display: flex; flex: 1; position: relative; overflow: hidden;";
	lastChild.appendChild(calendarContainer);

	calendarInstance = mount(Calendar, {
		target: calendarContainer,
		props: { onClose: closeCalendar },
	});

	updateActiveState();
}

function closeCalendar(): void {
	if (!calendarContainer) return;

	document.dispatchEvent(new CustomEvent("abt:sidepanel:close"));

	const parent = calendarContainer.parentElement as HTMLElement | null;

	unmount(calendarInstance!);
	calendarInstance = null;
	calendarContainer.remove();
	calendarContainer = null;

	for (const { el, display } of hiddenChildren) {
		if (el.parentElement) {
			el.style.display = display;
		}
	}
	hiddenChildren = [];

	if (parent) {
		parent.style.paddingTop = parent.dataset.abtOrigPadding || "";
		delete parent.dataset.abtOrigPadding;
	}

	if (isCalendarOpen()) {
		history.pushState({}, "", previousPath || "/budget");
	}
	previousPath = null;

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

function cleanup(): void {
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
	if (observer) {
		observer.disconnect();
		observer = null;
	}
}

export const spendingCalendar = defineSetting({
	type: "checkbox",
	label: "Spending Calendar",
	context: {
		key: "spending-calendar-enabled",
		defaultValue: false,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (!enabled) return;

		function tryInject() {
			if (document.querySelector('a[href="/schedules"]')) {
				injectSidebarLink();
				if (isCalendarOpen()) {
					openCalendar();
				}
			} else {
				setTimeout(tryInject, 500);
			}
		}
		tryInject();

		observer = new MutationObserver(() => {
			if (!document.querySelector(`[${LINK_ATTR}]`) && document.querySelector('a[href="/schedules"]')) {
				requestAnimationFrame(() => injectSidebarLink());
			}
			attachCloseListeners();
			updateActiveState();
		});
		observer.observe(document.body, { childList: true, subtree: true });

		window.addEventListener("popstate", () => {
			if (calendarContainer && !isCalendarOpen()) {
				closeCalendar();
			}
			updateActiveState();
		});

		window.addEventListener("abt:locationchange", () => {
			if (calendarContainer && !isCalendarOpen()) {
				closeCalendar();
			}
			updateActiveState();
		});
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (value) {
			injectSidebarLink();
			if (!observer) {
				observer = new MutationObserver(() => {
					if (!document.querySelector(`[${LINK_ATTR}]`) && document.querySelector('a[href="/schedules"]')) {
						requestAnimationFrame(() => injectSidebarLink());
					}
					updateActiveState();
				});
				observer.observe(document.body, { childList: true, subtree: true });
			}
		} else {
			cleanup();
		}
	},
});
