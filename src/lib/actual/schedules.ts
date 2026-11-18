/**
 * A schedule's `_amount` as Actual reads it (`getScheduledAmount`): the midpoint for "is between",
 * null when the rule has no amount condition.
 */
export function scheduleAmount(amount: unknown): number | null {
	if (typeof amount === "number") {
		return amount;
	}
	if (amount && typeof amount === "object") {
		const { num1, num2 } = amount as { num1?: unknown; num2?: unknown };
		if (typeof num1 === "number" && typeof num2 === "number") {
			return Math.round((num1 + num2) / 2);
		}
	}
	return null;
}
