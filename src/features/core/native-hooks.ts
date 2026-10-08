import { watchDom } from "@lib/utilities/dom-watcher";

/** Marks Actual elements that base.css styles but that carry no stable hook of their own. */
export const nativeHooks = {
	type: "core" as const,
	init: () => {
		watchDom(() => {
			// List pages (not the transaction table) wrap a header row and the table, which some
			// pages nest in a single-child div.
			if (!location.pathname.startsWith("/accounts")) {
				for (const table of document.querySelectorAll('[data-testid="table"]')) {
					if (table.closest('[role="dialog"]')) continue;
					let el: Element = table;
					while (el.parentElement?.childElementCount === 1) el = el.parentElement;
					const wrap = el.parentElement;
					if (wrap && wrap.firstElementChild !== el) mark(wrap, "data-abt-table");
				}
			}
			// Bank sync's and some modals' tables have no table test id; the header row sits two
			// levels under the frame.
			const frames = [...document.querySelectorAll('[role="dialog"]')];
			if (location.pathname === "/bank-sync")
				frames.push(...document.querySelectorAll('[role="main"]'));
			for (const frame of frames) {
				const header = frame.querySelector('[data-testid="row"]');
				if (header && !header.closest('[data-testid="table"]')) {
					mark(header.parentElement?.parentElement ?? null, "data-abt-card-table");
				}
			}
			mark(
				document.querySelector('[data-testid="budget-name"]')?.parentElement ?? null,
				"data-abt-sidebar-header",
			);
			mark(
				document.querySelector('[data-testid="sidebar-add-account"]')?.parentElement ?? null,
				"data-abt-sidebar-footer",
			);
			for (const input of document.querySelectorAll("input[data-rac]")) {
				if (input.previousElementSibling instanceof SVGElement) {
					mark(input.parentElement, "data-abt-search");
				}
			}
		});
	},
};

function mark(el: Element | null, attr: string): void {
	if (el && !el.hasAttribute(attr)) el.setAttribute(attr, "");
}
