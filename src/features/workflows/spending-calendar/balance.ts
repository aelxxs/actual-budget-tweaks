import type { Schedule, Transaction } from "@lib/types/actual-schema";
import { calculate } from "@lib/actual/actual-api";
import { parseScheduleAmount } from "./month-data";

/** One unpaid scheduled occurrence, signed as it lands in the selected accounts. */
interface Projected {
	date: string;
	amount: number;
}

/**
 * What a schedule's occurrence does to the selected accounts: its own amount if it's drawn
 * from one, the opposite if it's a transfer into one (both, netting to zero, if both are).
 * One with no account can only come out of the selection when it's a single account.
 */
export function scheduleEffect(
	s: Schedule,
	accounts: Set<string>,
	transferAccount: string | null,
): number {
	const amount = parseScheduleAmount(s._amount);
	if (!s._account) {
		return accounts.size === 1 ? amount : 0;
	}
	return (
		(accounts.has(s._account) ? amount : 0) +
		(transferAccount && accounts.has(transferAccount) ? -amount : 0)
	);
}

/**
 * Upcoming occurrences from today through `endDate`. Counted from the schedule's next date,
 * since anything before it was already paid and is in the transactions.
 */
export function projectSchedule(
	s: Schedule,
	dates: string[],
	effect: number,
	todayIso: string,
	endDate: string,
): Projected[] {
	const from = s.next_date && s.next_date > todayIso ? s.next_date : todayIso;
	const all = new Set(dates);
	if (s.next_date) {
		all.add(s.next_date);
	}
	return [...all]
		.filter((d) => d >= from && d <= endDate)
		.map((date) => ({ date, amount: effect }));
}

/**
 * Each day's closing balance across `accounts`: everything before the month, then the month's
 * transactions and upcoming bills day by day. Ignores the flow and category filters, since a
 * balance missing some of its transactions isn't one.
 */
export async function dailyBalances({
	accounts,
	startDate,
	daysInMonth,
	transactions,
	projected,
}: {
	accounts: Set<string>;
	startDate: string;
	daysInMonth: number;
	transactions: Transaction[];
	projected: Projected[];
}): Promise<Map<number, number>> {
	const before = await calculate<number>(
		"transactions",
		{ $sum: "$amount" },
		{
			filter: { account: { $oneof: [...accounts] }, date: { $lt: startDate } },
			options: { splits: "none" },
		},
	);

	const byDay = new Array<number>(daysInMonth + 1).fill(0);
	let opening = before ?? 0;
	for (const t of transactions) {
		if (t.date && accounts.has(t.account)) {
			byDay[Number(t.date.slice(-2))] += t.amount ?? 0;
		}
	}
	for (const p of projected) {
		if (p.date < startDate) {
			opening += p.amount;
		} else {
			byDay[Number(p.date.slice(-2))] += p.amount;
		}
	}

	const balances = new Map<number, number>();
	let running = opening;
	for (let d = 1; d <= daysInMonth; d++) {
		running += byDay[d];
		balances.set(d, running);
	}
	return balances;
}
