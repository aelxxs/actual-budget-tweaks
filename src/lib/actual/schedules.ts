import { fmtMoney } from "@lib/format/currency";
import type { ScheduleAmountOp } from "@lib/types/actual-schema";

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

/**
 * A schedule's amount as Actual's schedule list words it: "~$50" for "is about", "$40–$60" for
 * "is between". Money going out keeps its minus unless `unsigned`; `sign` adds a plus to income.
 */
export function scheduleAmountText(
	amount: unknown,
	op: ScheduleAmountOp | null | undefined,
	opts: { sign?: boolean; unsigned?: boolean } = {},
): string | null {
	const mid = scheduleAmount(amount);
	if (mid === null) {
		return null;
	}
	const prefix = mid > 0 && opts.sign ? "+" : mid < 0 && !opts.unsigned ? "-" : "";
	const range =
		amount && typeof amount === "object"
			? [(amount as { num1: number }).num1, (amount as { num2: number }).num2]
					.map(Math.abs)
					.sort((a, b) => a - b)
			: null;
	const body = range ? `${fmtMoney(range[0])}–${fmtMoney(range[1])}` : fmtMoney(Math.abs(mid));
	return `${op === "isapprox" ? "~" : ""}${prefix}${body}`;
}
