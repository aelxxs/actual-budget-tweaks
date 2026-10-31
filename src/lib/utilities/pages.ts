import { getCurrentPath } from "./route-watcher";
import { PAYEES_LINK, SETTINGS_LINK, SETTINGS_PAGE_LINK, SIDEBAR_NAV } from "@lib/actual-dom";

/** Known top-level routes in the Actual Budget app, matched as a `pathname` substring. */
export enum Page {
	Budget = "budget",
	Accounts = "accounts",
	Reports = "reports",
	Schedules = "schedules",
	Payees = "payees",
	Rules = "rules",
	BankSync = "bank-sync",
	Tags = "tags",
	Settings = "settings",
	Calendar = "calendar",
}

/**
 * A view ABT draws over Actual's page (the calendar), which counts as the page while open.
 * Only while its element is mounted on the same route, so a navigation or teardown nobody
 * reported (Actual's own route changes aren't visible to content scripts) can't leave it stuck.
 */
let overlay: { page: Page; el: Element; path: string } | null = null;

export function setOverlayPage(page: Page, el: Element): void {
	overlay = { page, el, path: getCurrentPath() };
}

export function clearOverlayPage(): void {
	overlay = null;
}

/** Pages Actual can put under /settings/ (actualbudget/actual#9110, #9193). */
const SETTINGS_PAGES: readonly Page[] = [
	Page.Schedules,
	Page.Payees,
	Page.Rules,
	Page.BankSync,
	Page.Tags,
];

/** Which of them the user keeps in the sidebar instead, set from Actual's sidebar menu pref. */
let sidebarPages: readonly Page[] = [Page.Schedules];

export function setSidebarPages(pages: readonly Page[]): void {
	sidebarPages = pages;
}

export function matchesPage(page: Page): boolean {
	if (overlay?.el.isConnected && overlay.path === getCurrentPath()) {
		return page === overlay.page;
	}
	const path = getCurrentPath();
	// On /settings/payees, Payees is the page, not Settings.
	if (page === Page.Settings && SETTINGS_PAGES.some((p) => path.includes(`/${p}`))) {
		return false;
	}
	return path.includes(page);
}

let nestedSettings = false;

/** Newer Actual drops the sidebar's More menu and links its settings sub-pages under /settings/. */
function usesNestedSettings(): boolean {
	if (nestedSettings) {
		return true;
	}
	const nav = document.querySelector(SIDEBAR_NAV);
	nestedSettings =
		!!document.querySelector(SETTINGS_PAGE_LINK) ||
		(!!nav?.querySelector(SETTINGS_LINK) && !nav.querySelector(PAYEES_LINK));
	return nestedSettings;
}

export function pagePath(page: Page): string {
	return SETTINGS_PAGES.includes(page) && !sidebarPages.includes(page) && usesNestedSettings()
		? `/settings/${page}`
		: `/${page}`;
}

/** Actual renders its mobile app below its "small" breakpoint (512px), a separate component tree. */
export const DESKTOP_QUERY = "(min-width: 512px)";

/** Keeps CSS written against desktop markup out of the mobile view. */
export function desktopOnly(css: string): string {
	return `@media ${DESKTOP_QUERY} {\n${css}\n}`;
}

/** Keeps CSS for Actual's mobile markup out of the desktop view. */
export function mobileOnly(css: string): string {
	return `@media not all and ${DESKTOP_QUERY} {\n${css}\n}`;
}

export function isMobileView(): boolean {
	return !matchMedia(DESKTOP_QUERY).matches;
}
