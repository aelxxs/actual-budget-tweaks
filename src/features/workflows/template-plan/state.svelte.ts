import type { BudgetMove } from "@lib/utilities/budget-moves";
import { type CardId, type CardLayout, TEMPLATES_BAR, defaultLayout } from "./cards";
import type { BreakdownSummary, PriorityCache } from "@lib/template-plan/priority-plan";

// ── Overview tab ──────────────────────────────────────────────────
export interface MonthTrend {
	monthKey: string;
	budgeted: number;
	spent: number;
	toBudget: number;
	income: number;
}

export interface OverviewIncome {
	received: number;
	/** The average of the last three earlier months with income; null without any. */
	usual: number | null;
	/** How many months `usual` averages. */
	usualMonths: number;
	categories: { id: string; name: string; amount: number }[];
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
	/** Negative for money going out; null when the schedule has no fixed amount. */
	amount: number | null;
}

export interface OverviewData {
	sheet: string;
	monthKey: string;
	budgetType: "envelope" | "tracking";
	availableFunds: number;
	toBudget: number;
	totalBudgeted: number;
	totalSpent: number;
	incomeBudgeted: number;
	spentBudgeted: number;
	saved: number;
	projected: number;
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
	/** Already assigned in next month. */
	nextMonthBudgeted: number;
	nextMonthGoalTotal: number | null;
	/** Template funding still missing this month (what Apply would add); null if unknown. */
	templateRemaining: number | null;
	/** The part of it Apply would assign: Apply skips categories that already have money. */
	templateToApply: number | null;
	hasTemplates: boolean;
	recentAvgSpending: number;
	/** Template needs for the months after next, as far as the spare money could reach; null while loading. */
	aheadTemplateNeeds: number[] | null;
	income: OverviewIncome;
	/** Moves made with Actual's transfer and cover menus, oldest first. */
	moves: BudgetMove[];
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

/** ABT's own budget actions, which Insights can't see from a click. */
export type TrackedAction = "fund" | "cover" | "apply" | "overwrite";

export interface BreakdownContext {
	kind: "apply-single" | "apply-group" | TrackedAction;
	month: string | null;
	notification: { type: "error" | "warning" | "info"; message: string } | null;
	priorityBreakdown: BreakdownSummary | null;
}

export interface BreakdownState {
	diff: BreakdownDiff;
	ctx: BreakdownContext;
	/** The budget it was applied in; another budget opening drops it. */
	budgetId?: string;
}

export const INSIGHTS_TABS = ["overview", "breakdown", "priority"] as const;
export type InsightsTab = (typeof INSIGHTS_TABS)[number];

export const templatePlanState = $state({
	/** Overview's card order and the hidden ones. */
	cards: defaultLayout() as CardLayout,
	/** Whether Overview's card menu is open. */
	customizingCards: false,
	/** The card the menu points at, spotlit in the panel. */
	highlightCard: null as CardId | typeof TEMPLATES_BAR | null,
	activeTab: "overview" as InsightsTab,
	trackingBudget: false,
	/** Whether the Insights feature is on, for other features that link into it. */
	enabled: false,
	/** Whether the Insights trigger should show, wherever it's drawn. */
	triggerShown: false,
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
	onTabChange: null as ((tab: InsightsTab) => void) | null,
	applyTemplates: null as (() => Promise<void>) | null,
	/** Runs `work` and shows what it changed in Breakdown; null while Insights is off. */
	trackBreakdown: null as (<T>(kind: TrackedAction, work: () => Promise<T>) => Promise<T>) | null,
	/** Re-reads the shown month's overview, quietly once there is one; null while Insights is off. */
	loadOverview: null as ((quiet: boolean) => void) | null,
	/** Saves the Overview card layout under the open budget; null while Insights is off. */
	saveCards: null as ((layout: unknown) => void) | null,
	/** A month's overview worked out ahead, if there is one; null while Insights is off. */
	peekOverview: null as ((sheet: string) => OverviewData | null) | null,
	/** Views outside the panel showing the overview, e.g. the summary row's Months ahead card. */
	overviewWanted: 0,
});
