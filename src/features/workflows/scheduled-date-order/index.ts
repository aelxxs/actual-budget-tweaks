import { defineSetting } from "@features/types";
import { DATE_CELL, TRANSACTION_HEADER, TRANSACTION_TABLE } from "@lib/actual-dom";
import { setScheduledDateOrder } from "@lib/actual/actual-api";
import { Page, matchesPage } from "@lib/actual/pages";
import { watchDom } from "@lib/dom/dom-watcher";
import { icon } from "@lib/icons";
import { getValue, setValue, watchValue } from "@lib/store";
import { SCHEDULED_ORDER_CSS, TOGGLE_ATTR } from "./css";

/** Which order the toggle shows, kept outside the setting's own key so it syncs as it changes. */
export const IN_ORDER_KEY = "scheduled-in-date-order";

const TITLES = {
	on: "Scheduled transactions are in date order. Click to show them on top.",
	off: "Scheduled transactions are on top. Click to show them in date order.",
};

/** Actual's own sort button in the Date header, which the toggle sits beside. */
const dateSortButton = () =>
	document.querySelector(`${TRANSACTION_HEADER} ${DATE_CELL} button:not([${TOGGLE_ATTR}])`);

export const scheduledDateOrder = defineSetting({
	type: "checkbox",
	label: "Scheduled transactions in date order",
	description:
		"A toggle on the Date header moves upcoming scheduled transactions in among the rest.",
	group: "Transactions",
	icon: "calendar",
	context: {
		key: "scheduled-date-order",
		defaultValue: false,
	},
	css: () => SCHEDULED_ORDER_CSS,
	init: async () => {
		let inOrder = (await getValue<unknown>(IN_ORDER_KEY, true)) !== false;
		// Account views the bridge has been told about; a remounted view brings a new table.
		const told = new WeakSet<Element>();
		let toggle: HTMLButtonElement | null = null;

		function showState(button: HTMLButtonElement) {
			const title = inOrder ? TITLES.on : TITLES.off;
			button.setAttribute("aria-pressed", String(inOrder));
			button.setAttribute("aria-label", title);
			button.title = title;
		}

		function onClick() {
			void setValue(IN_ORDER_KEY, !inOrder);
		}

		function scan() {
			if (!matchesPage(Page.Accounts)) {
				return;
			}
			const table = document.querySelector(TRANSACTION_TABLE);
			if (table && !told.has(table)) {
				told.add(table);
				void setScheduledDateOrder(inOrder);
			}
			const sortButton = dateSortButton();
			if (sortButton && toggle?.previousElementSibling !== sortButton) {
				toggle?.remove();
				toggle = document.createElement("button");
				toggle.type = "button";
				toggle.setAttribute(TOGGLE_ATTR, "");
				toggle.innerHTML = icon("calendarArrowDown", { size: 12 });
				toggle.addEventListener("click", onClick);
				showState(toggle);
				sortButton.after(toggle);
			}
		}

		function apply(value: unknown) {
			inOrder = value !== false;
			if (toggle) {
				showState(toggle);
			}
			void setScheduledDateOrder(inOrder);
		}

		const unwatchDom = watchDom(scan);
		const unwatchValue = watchValue(IN_ORDER_KEY, apply);
		scan();

		return () => {
			unwatchDom();
			unwatchValue();
			toggle?.remove();
			toggle = null;
			return setScheduledDateOrder(null).then(() => undefined);
		};
	},
});
