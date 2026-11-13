import { colorAmounts } from "@features/readability/color-amounts";
import { getValue, watchValue } from "@lib/store";

const { key, defaultValue } = colorAmounts.context;

/** Color amounts, which the live sidebar follows: negative balances turn red unless it's off. */
export const balanceColors = $state({ on: defaultValue !== "off" });

let started = false;
export function followBalanceColors(): void {
	if (started) {
		return;
	}
	started = true;
	void getValue<string>(key, defaultValue).then((v) => (balanceColors.on = v !== "off"));
	watchValue<string>(key, (v) => (balanceColors.on = (v ?? defaultValue) !== "off"));
}
