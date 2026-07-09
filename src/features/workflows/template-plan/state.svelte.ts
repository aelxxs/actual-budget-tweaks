import type { BreakdownSummary, PriorityCache } from "@lib/utilities/template-plan/priority-plan";

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
	activeTab: "priority" as "breakdown" | "priority",
	showAllRows: false,
	breakdownState: null as BreakdownState | null,
	breakdownLoading: false,
	priorityLoading: false,
	priorityData: null as PriorityCache | null,
	// Plain object, not a Map — $state only deep-proxies plain objects/arrays,
	// so a Map's .set() calls wouldn't trigger reactivity.
	prioCollapseOverrides: {} as Record<string, boolean>,
});
