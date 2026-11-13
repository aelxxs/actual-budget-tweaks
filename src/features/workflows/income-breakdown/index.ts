import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { matchesPage, Page } from "@lib/utilities/pages";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import { extendAddMenu, loadWidgets, PLACEHOLDER } from "./dashboard";
import { breakdown, loadOptions } from "./state.svelte";
import Widget from "./Widget.svelte";

const HOST_ATTR = "data-abt-ib-host";
const PLACEHOLDER_ATTR = "data-abt-ib-placeholder";
// Actual shows each widget's menu, marked this way, only while the dashboard is being arranged.
const EDITING = ".react-grid-item .hover-visible.non-draggable-area";

/** The placeholder's outermost element that holds nothing else, to hide under the chart. */
function placeholderOf(item: HTMLElement): HTMLElement | null {
	const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
	for (let text = walker.nextNode(); text; text = walker.nextNode()) {
		if (!text.textContent?.includes(PLACEHOLDER)) {
			continue;
		}
		let el = text.parentElement;
		while (
			el?.parentElement &&
			el.parentElement !== item &&
			el.parentElement.textContent?.trim() === PLACEHOLDER
		) {
			el = el.parentElement;
		}
		return el;
	}
	return null;
}

export const incomeBreakdown = defineSetting({
	type: "checkbox",
	label: "Income breakdown widget",
	description: "Adds an income breakdown chart to the reports' widget menu.",
	group: "Reports",
	icon: "trendingUp",
	context: {
		key: "income-breakdown",
		defaultValue: true,
	},
	css: () => `
		[${HOST_ATTR}] [${PLACEHOLDER_ATTR}] {
			visibility: hidden;
		}

		/* Its own menu replaces the Text widget's. */
		[${HOST_ATTR}] .hover-visible {
			display: none;
		}

		/* Keeps the grid's resize handle above the chart. */
		[${HOST_ATTR}] > .react-resizable-handle {
			z-index: 2;
		}
	`,
	init: async () => {
		const unwatchOptions = await loadOptions();
		const mounted = new Map<HTMLElement, Mounted & { id: string }>();
		let attaching = false;

		// Grid items carry no widget id, so they're matched to the saved widgets in reading order.
		async function attach(items: HTMLElement[]) {
			attaching = true;
			try {
				const taken = new Set([...mounted.values()].map((m) => m.id));
				const records = (await loadWidgets()).filter((r) => !taken.has(r.id));
				const ordered = items
					.map((item) => ({ item, rect: item.getBoundingClientRect() }))
					.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
				ordered.forEach(({ item }, i) => {
					const record = records[i];
					if (!record || !item.isConnected || mounted.has(item)) {
						return;
					}
					item.setAttribute(HOST_ATTR, "");
					placeholderOf(item)?.setAttribute(PLACEHOLDER_ATTR, "");
					const widget = mountToNodeWithReturn(Widget, { record });
					item.appendChild(widget.node);
					mounted.set(item, { ...widget, id: record.id });
				});
			} finally {
				attaching = false;
			}
		}

		const stop = watchDom(() => {
			for (const [item, widget] of mounted) {
				if (!item.isConnected) {
					widget.destroy();
					mounted.delete(item);
				}
			}
			if (!matchesPage(Page.Reports) || !document.querySelector("[data-abt-reports-dashboard]")) {
				return;
			}
			extendAddMenu();
			const editing = !!document.querySelector(EDITING);
			if (breakdown.editing !== editing) {
				breakdown.editing = editing;
			}
			if (attaching) {
				return;
			}
			const pending = [...document.querySelectorAll<HTMLElement>(".react-grid-item")].filter(
				(item) => !mounted.has(item) && item.textContent?.includes(PLACEHOLDER),
			);
			if (pending.length) {
				void attach(pending);
			}
		});

		return () => {
			stop();
			unwatchOptions();
			for (const [item, widget] of mounted) {
				widget.destroy();
				item.removeAttribute(HOST_ATTR);
			}
			mounted.clear();
			for (const el of document.querySelectorAll(`[${PLACEHOLDER_ATTR}]`)) {
				el.removeAttribute(PLACEHOLDER_ATTR);
			}
		};
	},
});
