import type { DayData, DayTransaction } from "./types";

export interface MonthSummary {
	spent: number;
	income: number;
	net: number;
	upcoming: number;
	hasUpcoming: boolean;
}

/**
 * Mirrors the budget page's Spent/Income: category activity, so refunds net out
 * and uncategorized money or on-budget transfers don't count.
 */
export function summarizeMonth(days: DayData[], incomeCategoryIds: Set<string>): MonthSummary {
	let spent = 0;
	let income = 0;
	let upcoming = 0;
	let hasUpcoming = false;
	for (const d of days) {
		if (!d.isCurrentMonth) continue;
		for (const t of d.transactions) {
			if (t.missed) continue;
			if (t.upcoming) {
				upcoming += t.amount;
				hasUpcoming = true;
			} else if (!t.categoryId) continue;
			else if (incomeCategoryIds.has(t.categoryId)) income += t.amount;
			else spent -= t.amount;
		}
	}
	return { spent, income, net: income - spent, upcoming, hasUpcoming };
}

export function maxDaySpent(days: DayData[]): number {
	return Math.max(0, ...days.map((d) => d.spent));
}

/** 0–1 spending intensity; sqrt so mid-sized days still register next to one huge outlier. */
export function dayHeat(day: DayData, maxSpent: number): number {
	return day.isCurrentMonth && maxSpent > 0 ? Math.sqrt(day.spent / maxSpent) : 0;
}

export type GroupedTransaction = DayTransaction & { count: number };

/** Folds same-payee entries of the same kind into one line with a count. */
export function groupByPayee(txs: DayTransaction[]): GroupedTransaction[] {
	const map = new Map<string, GroupedTransaction>();
	for (const tx of txs) {
		const key = `${tx.payee}|${tx.upcoming ? "u" : tx.missed ? "m" : "r"}`;
		const existing = map.get(key);
		if (existing) {
			existing.count++;
			existing.amount += tx.amount;
		} else {
			map.set(key, { ...tx, count: 1 });
		}
	}
	return Array.from(map.values());
}

/** Posted outflows per category, largest first, for the cell's category bars. */
export function spendingByCategory(txs: DayTransaction[]): [string, number][] {
	const acc: Record<string, number> = {};
	for (const t of txs) {
		if (!t.missed && t.amount < 0) acc[t.categoryId] = (acc[t.categoryId] || 0) - t.amount;
	}
	return Object.entries(acc).sort((a, b) => b[1] - a[1]);
}
