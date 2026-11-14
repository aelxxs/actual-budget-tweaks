import type { GoalDefEntry, Schedule } from "@lib/types/actual-schema";
import { addMonths, currentMonth, isoDate, parseMonth } from "@lib/format/months";
import { amountToCents } from "@lib/format/currency";
import type { TemplateEntry } from "@lib/actual/templates/templates";
import type { Category } from "@lib/actual/templates/priority-plan";
import type { BudgetMove } from "@lib/actual/budget-moves";
import type {
	LongGoalRow,
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
	const longGoals: LongGoalRow[] = [];
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

		// A template is met by this month's budget: a carried balance doesn't fund next month's rent.
		if (goal <= 0) {
			continue;
		}
		// A #goal is met over many months by the balance, so it isn't this month's to fund.
		if (cells.get(`long-goal-${cat.id}`) === 1) {
			longGoals.push({ ...row, balance: leftover, goal, monthly: budgeted, plan: null });
			continue;
		}
		totalGoalCount++;
		if (budgeted >= goal) {
			fullyFundedGoalCount++;
		} else {
			underfundedGoals.push({ ...row, leftover: budgeted, goal });
		}
	}

	overspentCategories.sort((a, b) => a.leftover - b.leftover);
	// Closest to done first; reached ones last.
	const share = (g: LongGoalRow) => (g.balance >= g.goal ? -1 : g.balance / g.goal);
	longGoals.sort((a, b) => share(b) - share(a));
	underfundedGoals.sort((a, b) => a.leftover - (a.goal ?? 0) - (b.leftover - (b.goal ?? 0)));

	return {
		totalSpent: spentIn(cats, cells),
		overspentCategories,
		underfundedGoals,
		longGoals,
		fullyFundedGoalCount,
		totalGoalCount,
	};
}

/**
 * This month's budget and spending meant for spending: long-term goals are savings, held rather
 * than spent. `flex` also leaves out fixed bills, paid in one go (rent on the 1st), which would make
 * any month look fast against an even pace; a category covering a schedule counts as a bill.
 */
export function spendingSplit(
	cats: Category[],
	cells: Cells,
	templates: Map<string, TemplateEntry[]>,
): { spendBudgeted: number; spendSpent: number; flexBudgeted: number; flexSpent: number } {
	const out = { spendBudgeted: 0, spendSpent: 0, flexBudgeted: 0, flexSpent: 0 };
	for (const cat of cats) {
		if (cat.is_income || cells.get(`long-goal-${cat.id}`) === 1) {
			continue;
		}
		const budgeted = cells.get(`budget-${cat.id}`) ?? 0;
		const spent = Math.max(0, -(cells.get(`sum-amount-${cat.id}`) ?? 0));
		out.spendBudgeted += budgeted;
		out.spendSpent += spent;
		if (!templates.get(cat.id)?.some((t) => t.kind === "schedule")) {
			out.flexBudgeted += budgeted;
			out.flexSpent += spent;
		}
	}
	return out;
}

/** Whether the month is still running, so its result is only so far. */
export const isRunning = (key: string): boolean => key === currentMonth();

/** Budgeted less spent: positive is money left, negative is spending over the budget. */
export const trendGap = (t: MonthTrend): number => t.budgeted - t.spent;

const monthsBetween = (from: string, to: string): number => {
	const a = parseMonth(from);
	const b = parseMonth(to);
	return (b.year - a.year) * 12 + (b.month - a.month);
};

/**
 * The pace each long-term goal's own templates set: a dated "save by" spreads what's left before
 * this month over the months to its deadline; a monthly amount is the pace as written.
 */
export function withGoalPlans(
	goals: LongGoalRow[],
	templates: Map<string, TemplateEntry[]>,
	monthKey: string,
): LongGoalRow[] {
	return goals.map((g) => {
		let perMonth = 0;
		let deadline: string | null = null;
		for (const t of templates.get(g.id) ?? []) {
			const d = t.engineTemplate as GoalDefEntry | undefined;
			if (d?.type === "by") {
				const months = Math.max(1, monthsBetween(monthKey, d.month) + 1);
				const before = g.balance - g.monthly;
				perMonth = Math.ceil(Math.max(0, amountToCents(d.amount) - before) / months);
				deadline = d.month;
				break;
			}
			if (d?.type === "simple" && d.monthly != null) {
				perMonth += amountToCents(d.monthly);
			} else if (d?.type === "periodic" && d.period.period === "month" && d.period.amount === 1) {
				perMonth += amountToCents(d.amount);
			}
		}
		return { ...g, plan: perMonth > 0 ? { perMonth, deadline } : null };
	});
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

/** Envelope budgets with templates plan next month by them; the rest by recent spending. */
export function usesGoalTemplates(d: Pick<OverviewData, "hasTemplates" | "budgetType">): boolean {
	return d.hasTemplates && d.budgetType === "envelope";
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
	fromId: string | null;
	toId: string | null;
	amount: number;
	/** How many moves between the two it stands for. */
	count: number;
}

export interface MoveDay {
	key: string;
	day: string;
	/** Set when every row moved money out of this one category; its rows then name only `to`. */
	from?: string;
	fromId?: string | null;
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
		const row = rows.get(key) ?? {
			key,
			from: move.from,
			to: move.to,
			fromId: move.fromId,
			toId: move.toId,
			amount: 0,
			count: 0,
		};
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
				groups.push({
					key: `${day}\u0000${from}`,
					day,
					from,
					fromId: sourced[0].fromId,
					rows: sourced,
				});
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
