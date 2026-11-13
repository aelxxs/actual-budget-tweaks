import "./tab.css";
import { navigate } from "@lib/actual/actual-api";
import { watchDom, watchElement } from "@lib/dom/dom-watcher";
import { isMobileView } from "@lib/actual/pages";
import {
	TWEAKS_HASH,
	TWEAKS_HOST_ATTR,
	TWEAKS_PATH,
	TWEAKS_SECTIONS_ATTR,
	openTweaksAt,
	settingsNav,
	tweaksSections,
} from "@lib/actual/settings-page";
import { SETTINGS, SETTINGS_ADVANCED_LINK, SETTINGS_NAV_LINK } from "@lib/actual-dom";

const LINK_ATTR = "data-abt-tweaks-link";
/** On Actual's settings nav, widened so the tab's section names fit on one line. */
const NAV_ATTR = "data-abt-settings-nav";
/** On Advanced's link, whose icon the stylesheet redraws. */
const ADVANCED_ATTR = "data-abt-settings-advanced";
/** On the nav while the tab is open, so Actual's own current link stops looking selected. */
const OPEN_ATTR = "data-abt-tweaks-open";
/** On the pane beside the nav, hiding Actual's page under ABT's. */
const PANE_ATTR = "data-abt-tweaks-pane";
/** Mobile: on Actual's General list while ABT's panel stands in for it, and on the page title. */
const MOBILE_HIDDEN_ATTR = "data-abt-tweaks-hidden";
const MOBILE_TITLE_ATTR = "data-abt-tweaks-title";
/** The tab's sections, listed under it while it's closed; the open page lists its own. */
const PREVIEW_ATTR = "data-abt-tweaks-preview";
const CHEVRON = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m12.95 10.707.707-.707L8 4.343 6.586 5.757 10.828 10l-4.242 4.243L8 15.657z" fill="currentColor"/></svg>`;

let link: HTMLAnchorElement | null = null;
let open = false;

function createLink(): HTMLAnchorElement {
	const a = document.createElement("a");
	a.href = TWEAKS_PATH;
	a.setAttribute(LINK_ATTR, "");
	const logo = document.createElement("img");
	logo.src = browser.runtime.getURL("/icon.svg");
	logo.alt = "";
	const label = document.createElement("span");
	label.textContent = "Tweaks";
	const chevron = document.createElement("span");
	chevron.className = "abt-tweaks-chevron";
	chevron.innerHTML = CHEVRON;
	a.append(logo, label, chevron);
	a.addEventListener("click", (e) => {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
			return;
		}
		e.preventDefault();
		if (!open) {
			navigate(TWEAKS_PATH);
		}
		setOpen(true);
	});
	return a;
}

function createPreview(): HTMLElement {
	const list = document.createElement("div");
	list.setAttribute(PREVIEW_ATTR, "");
	for (const { title, count } of tweaksSections()) {
		const button = document.createElement("button");
		button.type = "button";
		const label = document.createElement("span");
		label.textContent = title;
		const total = document.createElement("span");
		total.className = "abt-num";
		total.textContent = String(count);
		button.append(label, total);
		button.addEventListener("click", () => {
			openTweaksAt(title);
			navigate(TWEAKS_PATH);
			setOpen(true);
		});
		list.append(button);
	}
	return list;
}

function setOpen(next: boolean): void {
	open = next;
	sync();
}

function close(): void {
	document.querySelector(`[${TWEAKS_HOST_ATTR}]`)?.remove();
	document.querySelector(`[${TWEAKS_SECTIONS_ATTR}]`)?.remove();
	document.querySelector(`[${PANE_ATTR}]`)?.removeAttribute(PANE_ATTR);
	document.querySelector(`[${OPEN_ATTR}]`)?.removeAttribute(OPEN_ATTR);
	document.querySelector(`[${MOBILE_HIDDEN_ATTR}]`)?.removeAttribute(MOBILE_HIDDEN_ATTR);
	document.querySelector(`[${MOBILE_TITLE_ATTR}]`)?.removeAttribute(MOBILE_TITLE_ATTR);
	link?.removeAttribute("aria-current");
}

/**
 * Mobile shows Settings as a list of pages, each with its own route, so the address alone says
 * whether ABT's page is open: General's route with the tab's hash.
 */
function syncMobile(): void {
	const nav = settingsNav();
	if (nav) {
		link ??= createLink();
		if (link.parentElement !== nav) {
			nav.append(link);
		}
	} else {
		link?.remove();
	}
	const list = location.hash === TWEAKS_HASH ? document.querySelector(SETTINGS) : null;
	if (nav || !list?.parentElement) {
		close();
		return;
	}
	list.setAttribute(MOBILE_HIDDEN_ATTR, "");
	if (list.nextElementSibling?.hasAttribute(TWEAKS_HOST_ATTR) !== true) {
		const host = document.createElement("div");
		host.setAttribute(TWEAKS_HOST_ATTR, "");
		list.after(host);
	}
	const title = document.querySelector<HTMLElement>("[data-abt-content-grid] h1");
	if (title && !title.hasAttribute(MOBILE_TITLE_ATTR)) {
		title.setAttribute(MOBILE_TITLE_ATTR, "");
	}
}

function sync(): void {
	if (isMobileView()) {
		syncMobile();
		return;
	}
	const nav = settingsNav();
	if (!nav) {
		close();
		link?.remove();
		return;
	}
	link ??= createLink();
	// A nav that's just rendered (arriving at Settings, or back to it) opens on the address.
	if (!link.isConnected) {
		open = location.hash === TWEAKS_HASH;
	}
	if (link.parentElement !== nav) {
		nav.append(link);
		nav.setAttribute(NAV_ATTR, "");
	}
	for (const a of nav.querySelectorAll(SETTINGS_ADVANCED_LINK)) {
		a.setAttribute(ADVANCED_ATTR, "");
	}
	const pane = nav.nextElementSibling;
	if (!open || !pane) {
		close();
		if (link.nextElementSibling?.hasAttribute(PREVIEW_ATTR) !== true) {
			document.querySelector(`[${PREVIEW_ATTR}]`)?.remove();
			link.after(createPreview());
		}
		return;
	}
	document.querySelector(`[${PREVIEW_ATTR}]`)?.remove();
	nav.setAttribute(OPEN_ATTR, "");
	link.setAttribute("aria-current", "page");
	pane.setAttribute(PANE_ATTR, "");
	if (link.nextElementSibling?.hasAttribute(TWEAKS_SECTIONS_ATTR) !== true) {
		let sections = document.querySelector(`[${TWEAKS_SECTIONS_ATTR}]`);
		if (!sections) {
			sections = document.createElement("div");
			sections.setAttribute(TWEAKS_SECTIONS_ATTR, "");
		}
		link.after(sections);
	}
	if (!pane.querySelector(`:scope > [${TWEAKS_HOST_ATTR}]`)) {
		const host = document.createElement("div");
		host.setAttribute(TWEAKS_HOST_ATTR, "");
		pane.append(host);
	}
}

/** Any other link leaves the tab; Actual's own route changes aren't visible to content scripts. */
function onClick(e: MouseEvent): void {
	const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
	if (
		open &&
		a &&
		!a.hasAttribute(LINK_ATTR) &&
		a.target !== "_blank" &&
		!a.closest(`[${TWEAKS_HOST_ATTR}]`)
	) {
		setOpen(false);
	}
}

const onHistory = () => setOpen(location.hash === TWEAKS_HASH);

/** ABT's settings as a tab in Actual's settings nav (actualbudget/actual#9110). */
export const settingsTab = {
	type: "core" as const,
	init: () => {
		const unwatch = watchDom(sync);
		const unwatchNav = watchElement(SETTINGS_NAV_LINK, sync);
		document.addEventListener("click", onClick, true);
		window.addEventListener("popstate", onHistory);
		window.addEventListener("hashchange", onHistory);
		return () => {
			unwatch();
			unwatchNav();
			document.removeEventListener("click", onClick, true);
			window.removeEventListener("popstate", onHistory);
			window.removeEventListener("hashchange", onHistory);
			close();
			link?.remove();
			link = null;
			document.querySelector(`[${PREVIEW_ATTR}]`)?.remove();
			document.querySelector(`[${NAV_ATTR}]`)?.removeAttribute(NAV_ATTR);
		};
	},
};
