import { colorNegativeBalances } from "@features/readability/color-negative-balances";
import { getValue, watchValue } from "@lib/utilities/store";

const { key, defaultValue } = colorNegativeBalances.context;

/** Color Negative Balances, which the live sidebar follows as Actual's own sidebar does. */
export const balanceColors = $state({ on: defaultValue });

let started = false;
export function followBalanceColors(): void {
	if (started) {
		return;
	}
	started = true;
	void getValue<boolean>(key, defaultValue).then((v) => (balanceColors.on = Boolean(v)));
	watchValue<boolean>(key, (v) => (balanceColors.on = Boolean(v ?? defaultValue)));
}
