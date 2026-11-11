import type { Schedule } from "@lib/types/actual-schema";
import { addMonths, isoDate } from "@lib/utilities/months";
import type { Category } from "@lib/template-plan/priority-plan";
import type { BudgetMove } from "@lib/utilities/budget-moves";
import type {
	MonthTrend,
	OverviewCategoryRow,
	OverviewIncome,
	OverviewData,
	OverviewSchedule,
} from "./state.svelte";

type Cells = Map<string, number>;

const TREND_MONTHS = 6;
const SCHEDULE_DAYS = 30;
const MAX_SCHEDULES = 12;

export const monthCellNames = (cats: Category[], tracking = false): string[] => [
	"to-budget",
	"total-income",
	"total-budgeted",
	"available-funds",
	"last-month-overspent",
	"buffered-selected",
	...(tracking ? ["total-budget-income", "total-spent", "real-saved", "total-saved"] : []),
	...cats.flatMap((c) => [
		`sum-amount-${c.id}`,
		`leftover-${c.id}`,
		`budget-${c.id}`,
		`goal-${c.id}`,
		`long-goal-${c.id}`,
	]),
];

export const trendCellNames = (cats: Category[], tracking = false): string[] => [
	"to-budget",
	"total-income",
	"total-budgeted",
	...(tracking ? ["total-spent"] : []),
	...cats.map((c) => `sum-amount-${c.id}`),
];

/** The months the trend covers, oldest first, ending with `monthKey`. */
export const trendMonths = (monthKey: string): string[] =>
	Array.from({ length: TREND_MONTHS }, (_, i) => addMonths(monthKey, i - TREND_MONTHS + 1));

function spentIn(cats: Category[], cells: Cells): number {
	let spent = 0;
	for (const cat of cats) {
		const sum = cells.get(`sum-amount-${cat.id}`) ?? 0;
		if (sum < 0) {
			spent -= sum;
		}
	}
	return spent;
}

export function summarizeCategories(cats: Category[], cells: Cells) {
	const overspentCategories: OverviewCategoryRow[] = [];
	const underfundedGoals: OverviewCategoryRow[] = [];
	let fullyFundedGoalCount = 0;
	let totalGoalCount = 0;

	for (const cat of cats) {
		const leftover = cells.get(`leftover-${cat.id}`) ?? 0;
		const budgeted = cells.get(`budget-${cat.id}`) ?? 0;
		const goal = cells.get(`goal-${cat.id}`) ?? 0;
		const row = { id: cat.id, name: cat.name, groupName: cat.group_name };

		if (leftover < 0) {
			overspentCategories.push({ ...row, leftover });
		}

		// Actual's rule, as the summary row's Targets funded: a #goal by the balance, a template by
		// this month's budget (a carried balance doesn't fund next month's rent).
		const progress = cells.get(`long-goal-${cat.id}`) === 1 ? leftover : budgeted;
		if (goal <= 0) {
			continue;
		}
		totalGoalCount++;
		if (progress >= goal) {
			fullyFundedGoalCount++;
		} else {
			underfundedGoals.push({ ...row, leftover: progress, goal });
		}
	}

	overspentCategories.sort((a, b) => a.leftover - b.leftover);
	underfundedGoals.sort((a, b) => a.leftover - (a.goal ?? 0) - (b.leftover - (b.goal ?? 0)));

	return {
		totalSpent: spentIn(cats, cells),
		overspentCategories,
		underfundedGoals,
		fullyFundedGoalCount,
		totalGoalCount,
	};
}

/** The average assigned in months that had anything assigned. */
export function typicalMonth(trend: MonthTrend[]): number {
	const assigned = trend.filter((t) => t.budgeted > 0);
	return assigned.reduce((sum, t) => sum + t.budgeted, 0) / (assigned.length || 1);
}

type CoverageInputs = Pick<
	OverviewData,
	| "bufferedSelected"
	| "toBudget"
	| "hasTemplates"
	| "templateRemaining"
	| "nextMonthBudgeted"
	| "nextMonthGoalTotal"
	| "trend"
>;

/** Money held for next month: what's set aside, plus To Budget once this month's templates are funded. */
export function heldForNextMonth(d: CoverageInputs): number {
	const pending = d.hasTemplates ? Math.max(0, d.templateRemaining ?? 0) : 0;
	return d.bufferedSelected + Math.max(0, d.toBudget - pending);
}

/** Next month's need by its goal templates; null when they couldn't be previewed. */
export function nextMonthGoalNeed(d: CoverageInputs): number | null {
	return d.nextMonthGoalTotal === null
		? null
		: d.nextMonthBudgeted + d.nextMonthGoalTotal || typicalMonth(d.trend);
}

export function upcomingSchedules(schedules: Schedule[], today = new Date()): OverviewSchedule[] {
	const from = isoDate(today);
	const until = isoDate(
		new Date(today.getFullYear(), today.getMonth(), today.getDate() + SCHEDULE_DAYS),
	);
	return schedules
		.filter((s) => s.next_date && s.next_date >= from && s.next_date <= until)
		.sort((a, b) => (a.next_date ?? "").localeCompare(b.next_date ?? ""))
		.slice(0, MAX_SCHEDULES)
		.map((s) => ({
			id: s.id,
			name: s.name ?? "Unnamed",
			nextDate: s.next_date!,
			amount: typeof s._amount === "number" ? s._amount : null,
		}));
}

/** One entry per month in `months`, read from the matching cells. */
export function buildTrend(
	months: string[],
	monthCells: Cells[],
	cats: Category[],
	tracking = false,
): MonthTrend[] {
	return months.map((monthKey, i) => ({
		monthKey,
		budgeted: Math.abs(monthCells[i].get("total-budgeted") ?? 0),
		toBudget: monthCells[i].get("to-budget") ?? 0,
		spent: tracking
			? Math.abs(monthCells[i].get("total-spent") ?? 0)
			: spentIn(cats, monthCells[i]),
		income: monthCells[i].get("total-income") ?? 0,
	}));
}

/** This month's income by category, against the last three earlier months that had any. */
export function summarizeIncome(
	cats: Category[],
	cells: Cells,
	trend: MonthTrend[],
): OverviewIncome {
	const earlier = trend
		.slice(0, -1)
		.filter((t) => t.income > 0)
		.slice(-3);
	return {
		received: cells.get("total-income") ?? 0,
		usual: earlier.length ? earlier.reduce((sum, t) => sum + t.income, 0) / earlier.length : null,
		usualMonths: earlier.length,
		categories: cats
			.filter((c) => c.is_income)
			.map((c) => ({ id: c.id, name: c.name, amount: cells.get(`sum-amount-${c.id}`) ?? 0 }))
			.filter((c) => c.amount !== 0),
	};
}

/** The last three months with spending among the five before this one; `fallback` if none. */
export function recentAverageSpending(trend: MonthTrend[], fallback: number): number {
	const recent = trend
		.slice(0, -1)
		.filter((t) => t.spent > 0)
		.slice(-3);
	return recent.length ? recent.reduce((sum, t) => sum + t.spent, 0) / recent.length : fallback;
}

export interface MoveRow {
	key: string;
	from: string;
	to: string;
	amount: number;
	/** How many moves between the two it stands for. */
	count: number;
}

export interface MoveDay {
	key: string;
	day: string;
	/** Set when every row moved money out of this one category; its rows then name only `to`. */
	from?: string;
	rows: MoveRow[];
}

/**
 * The month's moves by the day they were made, newest first, with repeat moves between the same
 * two categories that day added up into one row. A day's moves out of one category share a heading.
 */
export function groupMoves(moves: BudgetMove[]): MoveDay[] {
	const days = new Map<string, Map<string, MoveRow>>();
	for (const move of moves) {
		let rows = days.get(move.day);
		if (!rows) {
			rows = new Map();
			days.set(move.day, rows);
		}
		const key = `${move.from}\u0000${move.to}`;
		const row = rows.get(key) ?? { key, from: move.from, to: move.to, amount: 0, count: 0 };
		row.amount += move.amount;
		row.count += 1;
		// Re-added so the day's rows run by their latest move.
		rows.delete(key);
		rows.set(key, row);
	}
	return [...days].reverse().flatMap(([day, byPair]) => {
		const rows = [...byPair.values()].reverse();
		const bySource = new Map<string, MoveRow[]>();
		for (const row of rows) {
			bySource.set(row.from, [...(bySource.get(row.from) ?? []), row]);
		}
		const groups: MoveDay[] = [];
		const loose: MoveRow[] = [];
		for (const [from, sourced] of bySource) {
			if (sourced.length > 1) {
				groups.push({ key: `${day}\u0000${from}`, day, from, rows: sourced });
			} else {
				loose.push(...sourced);
			}
		}
		if (loose.length) {
			groups.push({ key: day, day, rows: loose });
		}
		return groups;
	});
}

/** The first `limit` rows across the days, keeping their headings. */
export function firstMoveRows(days: MoveDay[], limit: number): MoveDay[] {
	const out: MoveDay[] = [];
	let left = limit;
	for (const group of days) {
		if (left <= 0) {
			break;
		}
		out.push({ ...group, rows: group.rows.slice(0, left) });
		left -= group.rows.length;
	}
	return out;
}

export interface RunwayMonth {
	key: string;
	/** How much of the month's need the held money still covers, 0 to 1. */
	fill: number;
}

export interface Runway {
	/** From next month on, at least `shown` long, each month against its own need. */
	months: RunwayMonth[];
	/** Index of the last fully covered month; -1 when next month isn't. */
	lastCovered: number;
}

/** Spends what's held month by month from `monthKey`, each against its own need. */
export function runway(monthKey: string, held: number, needs: number[], shown = 6): Runway | null {
	if (!needs.length || needs[0] <= 0) {
		return null;
	}
	const months: RunwayMonth[] = [];
	let left = Math.max(0, held);
	for (const [i, n] of needs.entries()) {
		if (n <= 0) {
			break;
		}
		months.push({ key: addMonths(monthKey, i), fill: Math.min(1, left / n) });
		left = Math.max(0, left - n);
	}
	while (months.length < shown) {
		months.push({ key: addMonths(monthKey, months.length), fill: 0 });
	}
	return { months, lastCovered: months.findLastIndex((m) => m.fill >= 1) };
}
