import type { Schedule } from "@lib/types/actual-schema";
import { addMonths, isoDate } from "@lib/utilities/months";
import type { Category } from "@lib/template-plan/priority-plan";
import type {
	MonthTrend,
	OverviewCategoryRow,
	OverviewData,
	OverviewSchedule,
} from "./state.svelte";

type Cells = Map<string, number>;

const TREND_MONTHS = 6;
const SCHEDULE_DAYS = 30;
const MAX_SCHEDULES = 12;

export const monthCellNames = (cats: Category[]): string[] => [
	"to-budget",
	"total-budgeted",
	"available-funds",
	"last-month-overspent",
	"buffered-selected",
	...cats.flatMap((c) => [
		`sum-amount-${c.id}`,
		`leftover-${c.id}`,
		`budget-${c.id}`,
		`goal-${c.id}`,
		`long-goal-${c.id}`,
	]),
];

export const trendCellNames = (cats: Category[]): string[] => [
	"to-budget",
	"total-budgeted",
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
export function buildTrend(months: string[], monthCells: Cells[], cats: Category[]): MonthTrend[] {
	return months.map((monthKey, i) => ({
		monthKey,
		budgeted: Math.abs(monthCells[i].get("total-budgeted") ?? 0),
		toBudget: monthCells[i].get("to-budget") ?? 0,
		spent: spentIn(cats, monthCells[i]),
	}));
}

/** The last three months with spending among the five before this one; `fallback` if none. */
export function recentAverageSpending(trend: MonthTrend[], fallback: number): number {
	const recent = trend
		.slice(0, -1)
		.filter((t) => t.spent > 0)
		.slice(-3);
	return recent.length ? recent.reduce((sum, t) => sum + t.spent, 0) / recent.length : fallback;
}
