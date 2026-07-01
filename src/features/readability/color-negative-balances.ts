import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";

const BALANCE_SELECTOR =
	"span[data-testid^='__global!balance-']:not([data-testid^='__global!balance-query']), span[data-testid$='-balance']";

// Match both ASCII hyphen-minus (-) and Unicode minus sign (−, U+2212),
// optionally followed by non-digit chars (currency symbols, spaces) before a digit.
const SEARCH_PATTERN = /[-\u2212][^\d]*\d/;

function setAccountBalanceColors() {
	for (const el of document.querySelectorAll(BALANCE_SELECTOR)) {
		el.classList.toggle("error", SEARCH_PATTERN.test(el.textContent));
	}
}

function cleanup() {
	for (const el of document.querySelectorAll(BALANCE_SELECTOR)) {
		el.classList.remove("error");
	}
}

export const colorNegativeBalances = defineSetting({
	type: "checkbox",
	label: "Color Negative Account Balances",
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
