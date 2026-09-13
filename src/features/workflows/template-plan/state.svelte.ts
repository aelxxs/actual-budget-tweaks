import type { BreakdownSummary, PriorityCache } from "@lib/utilities/template-plan/priority-plan";

// ── Overview tab ──────────────────────────────────────────────────
export interface MonthTrend {
	monthKey: string;
	budgeted: number;
	spent: number;
	toBudget: number;
}

export interface OverviewCategoryRow {
	id: string;
	name: string;
	groupName: string;
	leftover: number;
	goal?: number;
}

export interface OverviewSchedule {
	id: string;
	name: string;
	nextDate: string;
}

export interface OverviewData {
	sheet: string;
	monthKey: string;
	availableFunds: number;
	toBudget: number;
	totalBudgeted: number;
	totalSpent: number;
	lastMonthOverspent: number;
	bufferedSelected: number;
	overspentCategories: OverviewCategoryRow[];
	underfundedGoals: OverviewCategoryRow[];
	fullyFundedGoalCount: number;
	totalGoalCount: number;
	upcomingSchedules: OverviewSchedule[];
	// Trend & next-month
	trend: MonthTrend[];
	nextMonthKey: string;
	nextMonthToBudget: number;
	nextMonthGoalTotal: number | null;
	recentAvgSpending: number;
}

export type BreakdownGroup = {
	id: string;
	name: string;
	sort_order: number;
	rows: Array<{
		id: string;
		name: string;
		sort_order: number;
		before: number;
		after: number;
		delta: number;
	}>;
};

export interface BreakdownDiff {
	groups: BreakdownGroup[];
	totalAllocated: number;
	availableBefore: number;
	availableAfter: number;
	toBudgetBefore: number;
	toBudgetAfter: number;
}

export interface BreakdownContext {
	kind: "apply" | "overwrite" | "apply-single" | "apply-group";
	month: string | null;
	notification: { type: "error" | "warning" | "info"; message: string } | null;
	priorityBreakdown: BreakdownSummary | null;
}

export interface BreakdownState {
	diff: BreakdownDiff;
	ctx: BreakdownContext;
}

export const templatePlanState = $state({
	coverageMethod: "goal-templates" as "goal-templates" | "spending-average",
	activeTab: "overview" as "breakdown" | "priority" | "overview",
	showAllRows: false,
	breakdownState: null as BreakdownState | null,
	breakdownLoading: false,
	priorityLoading: false,
	priorityData: null as PriorityCache | null,
	// Plain object, not a Map — $state only deep-proxies plain objects/arrays,
	// so a Map's .set() calls wouldn't trigger reactivity.
	prioCollapseOverrides: {} as Record<string, boolean>,
	overviewData: null as OverviewData | null,
	overviewLoading: false,
	// Callbacks registered by index.ts.
	onTabChange: null as ((tab: string) => void) | null,
	applyTemplates: null as (() => Promise<void>) | null,
});
