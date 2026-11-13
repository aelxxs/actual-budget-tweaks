import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { SHEET_BALANCES } from "@lib/actual-dom";

// Match both ASCII hyphen-minus (-) and Unicode minus sign (−, U+2212),
// optionally followed by non-digit chars (currency symbols, spaces) before a digit.
const SEARCH_PATTERN = /[-\u2212][^\d]*\d/;

function setAccountBalanceColors() {
	for (const el of document.querySelectorAll(SHEET_BALANCES)) {
		el.classList.toggle("error", SEARCH_PATTERN.test(el.textContent));
	}
}

function cleanup() {
	for (const el of document.querySelectorAll(SHEET_BALANCES)) {
		el.classList.remove("error");
	}
}

export const colorNegativeBalances = defineSetting({
	type: "checkbox",
	label: "Color negative balances",
	description: "Shows negative account balances in red.",
	group: "Accounts",
	icon: "palette",
	context: {
		key: "actual-balancecolors",
		defaultValue: true,
	},
	css: () => `
		.error {
			color: var(--color-errorText);
		}
	`,
	init: () => {
		const unwatch = watchDom(setAccountBalanceColors);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
