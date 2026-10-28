import { markBudgetType, refreshBudgetType } from "@lib/utilities/budget-type";
import { watchDom, watchElement } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { getCurrentPath, watchRoute } from "@lib/utilities/route-watcher";
import { hasSettingsPages } from "@lib/utilities/settings-page";
import {
	DIALOG,
	HELP_BUTTON,
	MAIN,
	PAGE_COLUMN,
	REPORTS_PAGE,
	ROW,
	SETTINGS,
	TABLE,
} from "@lib/actual-dom";

// Settings' sub-pages first, so /settings/payees reads as Payees.
const COLUMN_PAGES = [
	Page.Payees,
	Page.Rules,
	Page.BankSync,
	Page.Tags,
	Page.Settings,
	Page.Accounts,
	Page.Schedules,
];

// Actual wraps dashboards and single reports in the same test id; a dashboard's id is a UUID.
const DASHBOARD_PATH =
	/^\/reports(\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\/?$/i;

/** Marks Actual elements that base.css styles but that carry no stable hook of their own. */
export const nativeHooks = {
	type: "core" as const,
	init: () => {
		markBudgetType();
		// Switching type in Settings saves without a reload, so it's re-read on each page change.
		watchRoute(() => void refreshBudgetType());
		// The titlebar renders before the budget loads, but the content grid holding it is only
		// told apart once a page has rendered; found from Help (Titlebar > cluster > wrapper > button).
		watchElement(HELP_BUTTON, () => {
			const header =
				document.querySelector(HELP_BUTTON)?.parentElement?.parentElement?.parentElement;
			if (header && header.parentElement?.firstElementChild === header) {
				mark(header, "data-abt-header");
			}
		});
		// Actual's settings nav came with cards grouped under headings; base.css styles each layout.
		watchElement(SETTINGS, () => {
			if (hasSettingsPages()) {
				for (const list of document.querySelectorAll(SETTINGS)) {
					mark(list, "data-abt-settings-grouped");
				}
			}
		});
		watchDom(() => {
			// List pages (not the transaction table) wrap a header row and the table, which some
			// pages nest in a single-child div.
			if (!location.pathname.startsWith("/accounts")) {
				for (const table of document.querySelectorAll(TABLE)) {
					if (table.closest(DIALOG)) {
						continue;
					}
					let el: Element = table;
					while (el.parentElement?.childElementCount === 1) {
						el = el.parentElement;
					}
					const wrap = el.parentElement;
					if (wrap && wrap.firstElementChild !== el) {
						mark(wrap, "data-abt-table");
					}
				}
			}
			// Bank sync's and some modals' tables have no table test id; the header row sits two
			// levels under the frame.
			const frames = [...document.querySelectorAll(DIALOG)];
			if (matchesPage(Page.BankSync)) {
				frames.push(...document.querySelectorAll(MAIN));
			}
			for (const frame of frames) {
				const header = frame.querySelector(ROW);
				if (header && !header.closest(TABLE)) {
					mark(header.parentElement?.parentElement ?? null, "data-abt-card-table");
				}
			}
			// The page's column, named so base.css can give each page's layout the same gutter.
			const column = document.querySelector<HTMLElement>(PAGE_COLUMN);
			const path = getCurrentPath();
			const shownPath = column ? pathOf(column, path) : path;
			const page = COLUMN_PAGES.find((p) => shownPath.includes(`/${p}`)) ?? "";
			if (column && column.dataset.abtPage !== page) {
				column.dataset.abtPage = page;
			}
			const reports = document.querySelector(REPORTS_PAGE);
			const dashboard = !!reports && DASHBOARD_PATH.test(pathOf(reports, path));
			if (reports && reports.hasAttribute("data-abt-reports-dashboard") !== dashboard) {
				reports.toggleAttribute("data-abt-reports-dashboard", dashboard);
			}
			for (const input of document.querySelectorAll("input[data-rac]")) {
				if (input.previousElementSibling instanceof SVGElement) {
					mark(input.parentElement, "data-abt-search");
				}
			}
		});
	},
};

// The path each page's root was rendered for. Navigating changes the path a frame before Actual
// swaps in the next page's root, which would otherwise take the next page's styles meanwhile.
const rootPaths = new WeakMap<Element, string>();
const topSegment = (path: string) => path.split("/")[1] ?? "";

function pathOf(root: Element, path: string): string {
	const known = rootPaths.get(root);
	// Sub-pages of one route (Settings' own pages) may share a root, so those follow the path.
	if (known === undefined || topSegment(known) === topSegment(path)) {
		rootPaths.set(root, path);
		return path;
	}
	return known;
}

function mark(el: Element | null, attr: string): void {
	if (el && !el.hasAttribute(attr)) {
		el.setAttribute(attr, "");
	}
}
