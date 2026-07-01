import { defineSetting } from "@features/types";
import { applyGlobalCSS, createDebouncedObserver, type DebouncedObserver } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

export const colorNegativeBalances = defineSetting({
	type: "checkbox",
	label: "Color Negative Account Balances",
	context: {
		key: "actual-balancecolors",
		defaultValue: true,
		css: `
			.error {
				color: var(--color-errorText);
			}
		`,
		_observer: null as DebouncedObserver | null,
	},
	init: async (ctx) => {
		applyGlobalCSS(ctx.css, ctx.key);
		const BALANCE_SELECTOR =
			"span[data-testid^='__global!balance-']:not([data-testid^='__global!balance-query']), span[data-testid$='-balance']";

		// Match both ASCII hyphen-minus (-) and Unicode minus sign (−, U+2212),
		// optionally followed by non-digit chars (currency symbols, spaces) before a digit.
		const searchPattern = /[-\u2212][^\d]*\d/;

		const setAccountBalanceColors = () => {
			for (const el of document.querySelectorAll(BALANCE_SELECTOR)) {
				el.classList.toggle("error", searchPattern.test(el.textContent ?? ""));
			}
		};

		setAccountBalanceColors();

		ctx._observer = createDebouncedObserver(setAccountBalanceColors, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled) {
			ctx._observer.observe(document.body);
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);

		if (value) {
			applyGlobalCSS(ctx.css, ctx.key);
			ctx._observer?.observe(document.body);
		} else {
			applyGlobalCSS("", ctx.key);
			ctx._observer?.disconnect();
		}
	},
});
