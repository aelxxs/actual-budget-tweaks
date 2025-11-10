import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { CheckboxSetting } from "./types";

export const colorNegativeBalances: CheckboxSetting = {
	type: "checkbox",
	label: "Color Negative Balances",
	context: {
		key: "actual-balancecolors",
		defaultValue: true,
		_observer: null,
	},
	init: async (ctx) => {
		applyGlobalCSS(
			`
                  .error {
                    color: var(--color-errorText);
                  }
                `,
			ctx.key
		);
		const BALANCE_SELECTOR =
			"span[data-testid^='__global!balance-']:not([data-testid^='__global!balance-query']), span[data-testid$='-balance']";

		const searchPattern = /^\-\d+/;

		const setAccountBalanceColors = () => {
			for (const el of document.querySelectorAll(BALANCE_SELECTOR)) {
				el.classList.toggle("error", searchPattern.test(el.textContent));
			}
		};

		setAccountBalanceColors();

		let scheduled = false;
		const observer = new MutationObserver(() => {
			if (!scheduled) {
				scheduled = true;
				requestAnimationFrame(() => {
					setAccountBalanceColors();
					scheduled = false;
				});
			}
		});
		ctx._observer = observer;

		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled) {
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		}
	},
	onChange: async (value, ctx) => {
		if (!value) {
			applyGlobalCSS("", ctx.key);
			ctx._observer?.disconnect();
		} else {
			applyGlobalCSS(
				`
					  .error {
						color: var(--color-errorText);
					  }
					`,
				ctx.key
			);
			ctx._observer?.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		}
		await setValue(ctx.key, value);
	},
};
