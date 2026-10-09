import { getCurrentPath } from "./route-watcher";

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

export function matchesPage(page: Page): boolean {
	if (overlay?.el.isConnected && overlay.path === getCurrentPath()) return page === overlay.page;
	return getCurrentPath().includes(page);
}

/** Actual renders its mobile app below its "small" breakpoint (512px), a separate component tree. */
export const DESKTOP_QUERY = "(min-width: 512px)";

/** Keeps CSS written against desktop markup out of the mobile view. */
export function desktopOnly(css: string): string {
	return `@media ${DESKTOP_QUERY} {\n${css}\n}`;
}

export function isMobileView(): boolean {
	return !matchMedia(DESKTOP_QUERY).matches;
}
