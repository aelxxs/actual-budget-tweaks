import { defineSetting } from "@features/types";
import { Page, matchesPage } from "@lib/actual/pages";
import { DATE_CELL, TRANSACTION_ROW } from "@lib/actual-dom";
import { watchDom } from "@lib/dom/dom-watcher";
import { loadDatePrefs, parseDate } from "@lib/format/date-format.svelte";
import { isoDate } from "@lib/format/months";
import { getValue, watchValue } from "@lib/store";
import { DEFAULT_FUTURE_COLOR, FUTURE_COLOR_KEY, isHexColor } from "./color";
import FutureColor from "./FutureColor.svelte";

const FUTURE_ATTR = "data-abt-future";
const COLOR_VAR = "--abt-future-color";

// !important: Actual's rows and their cells paint their own backgrounds.
const CSS = `
	[${FUTURE_ATTR}] {
		background-color: var(${COLOR_VAR}, ${DEFAULT_FUTURE_COLOR}) !important;
	}
`;

// The date cell's text, or its input's value while the date is being edited.
function dateOf(row: Element): string | null {
	const cell = row.querySelector(DATE_CELL);
	if (!cell) {
		return null;
	}
	const input = cell.querySelector("input");
	return parseDate(input ? input.value : (cell.textContent ?? ""));
}

function startMarking(): () => void {
	let datesKnown = false;

	const mark = () => {
		if (!matchesPage(Page.Accounts)) {
			datesKnown = false;
			return;
		}
		// Read dates in Actual's own format, which is only known once its preferences load.
		if (!datesKnown) {
			datesKnown = true;
			void loadDatePrefs().then(mark);
			return;
		}
		// ISO dates sort as text, so no Date (and no time zone) comes into it.
		const today = isoDate();
		for (const row of document.querySelectorAll(TRANSACTION_ROW)) {
			const date = dateOf(row);
			const future = date !== null && date > today;
			if (future !== row.hasAttribute(FUTURE_ATTR)) {
				row.toggleAttribute(FUTURE_ATTR, future);
			}
		}
	};

	const unwatch = watchDom(mark);
	return () => {
		unwatch();
		for (const row of document.querySelectorAll(`[${FUTURE_ATTR}]`)) {
			row.removeAttribute(FUTURE_ATTR);
		}
	};
}

// The colour lives on the root as a variable, so changing it needs no restart of the tweak.
function startColor(): () => void {
	let on = true;
	const root = document.documentElement;
	const apply = (value: unknown) => {
		if (on) {
			root.style.setProperty(COLOR_VAR, isHexColor(value) ? value : DEFAULT_FUTURE_COLOR);
		}
	};
	void getValue<unknown>(FUTURE_COLOR_KEY, DEFAULT_FUTURE_COLOR).then(apply);
	const unwatch = watchValue<unknown>(FUTURE_COLOR_KEY, apply);
	return () => {
		on = false;
		unwatch();
		root.style.removeProperty(COLOR_VAR);
	};
}

export const highlightFutureTransactions = defineSetting({
	type: "checkbox",
	label: "Highlight future transactions",
	description: "Tints transactions dated after today.",
	group: "Transactions",
	icon: "calendar",
	details: FutureColor,
	context: {
		key: "highlight-future-transactions",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		const stops = [startColor(), startMarking()];
		return () => {
			for (const stop of stops) {
				stop();
			}
		};
	},
});
