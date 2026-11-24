import { defineSetting } from "@features/types";
import { headerRowOf, MODAL, TABLE } from "@lib/actual-dom";
import { markScheduleColumns, setScheduleOrder } from "@lib/actual/actual-api";
import { Page, matchesPage } from "@lib/actual/pages";
import { watchDom } from "@lib/dom/dom-watcher";
import { icon } from "@lib/icons";
import { getValue, setValue, watchValue } from "@lib/store";
import { ARROW_ATTR, COLUMN_ATTR, DIR_ATTR, SCHEDULE_SORT_CSS } from "./css";
import {
	type SortColumn,
	type SortOrder,
	SORT_COLUMNS,
	nextOrder,
	orderExpressions,
	readOrder,
} from "./data";

/** The column clicked last, kept outside the setting's own key so it syncs as it changes. */
export const ORDER_KEY = "schedule-sort-order";

const LABELS: Record<SortColumn, string> = { name: "name", next_date: "next date" };

function schedulesHeader(): Element | null {
	const table = [...document.querySelectorAll(TABLE)].find((t) => !t.closest(MODAL));
	return table ? headerRowOf(table) : null;
}

export const scheduleSort = defineSetting({
	type: "checkbox",
	label: "Sortable schedule columns",
	description: "Click Name or Next date in the schedules table to sort by it.",
	group: "Transactions",
	icon: "sortAlpha",
	platform: "all",
	context: {
		key: "schedule-sort",
		defaultValue: false,
	},
	css: () => SCHEDULE_SORT_CSS,
	init: async () => {
		let order: SortOrder | null = readOrder(await getValue(ORDER_KEY, null));
		// Header rows the bridge has been asked to tag, so a header it can't read isn't asked again.
		const asked = new WeakSet<Element>();
		const decorated = new Set<HTMLElement>();

		function onClick(e: Event) {
			const column = (e.currentTarget as HTMLElement).getAttribute(COLUMN_ATTR) as SortColumn;
			void setValue(ORDER_KEY, nextOrder(order, column));
		}

		function onKey(e: KeyboardEvent) {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onClick(e);
			}
		}

		function showOrder(field: HTMLElement) {
			const column = field.getAttribute(COLUMN_ATTR) as SortColumn;
			const dir = order?.column === column ? order.dir : null;
			if (dir) {
				field.setAttribute(DIR_ATTR, dir);
			} else {
				field.removeAttribute(DIR_ATTR);
			}
			const sorted = dir ? `, sorted ${dir === "asc" ? "ascending" : "descending"}` : "";
			field.title = `Sort by ${LABELS[column]}${sorted}`;
		}

		function decorate(field: HTMLElement) {
			const content = field.querySelector(":scope > div:first-of-type");
			if (!content) {
				return;
			}
			if (!content.querySelector(`[${ARROW_ATTR}]`)) {
				const arrow = document.createElement("span");
				arrow.setAttribute(ARROW_ATTR, "");
				arrow.innerHTML = icon("arrowDown", { size: 12 });
				content.append(arrow);
			}
			if (!decorated.has(field)) {
				decorated.add(field);
				field.tabIndex = 0;
				field.setAttribute("role", "button");
				field.addEventListener("click", onClick);
				field.addEventListener("keydown", onKey);
			}
			showOrder(field);
		}

		function scan() {
			if (!matchesPage(Page.Schedules)) {
				return;
			}
			for (const field of decorated) {
				if (!field.isConnected) {
					decorated.delete(field);
				}
			}
			const header = schedulesHeader();
			if (!header) {
				return;
			}
			if (!header.querySelector(`[${COLUMN_ATTR}]`) && !asked.has(header)) {
				asked.add(header);
				markScheduleColumns();
			}
			for (const field of header.querySelectorAll<HTMLElement>(`:scope > [${COLUMN_ATTR}]`)) {
				if (SORT_COLUMNS.includes(field.getAttribute(COLUMN_ATTR) as SortColumn)) {
					decorate(field);
				}
			}
		}

		function apply(value: unknown) {
			order = readOrder(value);
			void setScheduleOrder(order ? orderExpressions(order) : null);
			for (const field of decorated) {
				showOrder(field);
			}
		}

		apply(order);
		const unwatchDom = watchDom(scan);
		const unwatchValue = watchValue(ORDER_KEY, apply);
		scan();

		return () => {
			unwatchDom();
			unwatchValue();
			for (const field of decorated) {
				field.removeEventListener("click", onClick);
				field.removeEventListener("keydown", onKey);
				field.removeAttribute("tabindex");
				field.removeAttribute("role");
				field.removeAttribute("title");
				field.removeAttribute(DIR_ATTR);
				field.removeAttribute(COLUMN_ATTR);
				field.querySelector(`[${ARROW_ATTR}]`)?.remove();
			}
			decorated.clear();
			return setScheduleOrder(null);
		};
	},
});
