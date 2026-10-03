import { send } from "@lib/utilities/actual-api";

export interface GoalState {
	goal: number;
	/** Long goals (#goal) compare the balance; templates compare the budgeted amount. */
	isLongGoal: boolean;
	budgeted: number;
	current: number;
	toBudget: number | null;
}

async function cell(sheet: string, name: string): Promise<number | null> {
	const res = await send<{ value?: unknown }>("get-cell", { sheetName: sheet, name });
	return typeof res?.value === "number" ? res.value : null;
}

// Mirrors Actual's own balance pill, so "needed" matches its underfunded state.
export async function loadGoalState(sheet: string, categoryId: string): Promise<GoalState | null> {
	const [goal, longGoal, budgeted, balance, toBudget] = await Promise.all([
		cell(sheet, `goal-${categoryId}`),
		cell(sheet, `long-goal-${categoryId}`),
		cell(sheet, `budget-${categoryId}`),
		cell(sheet, `leftover-${categoryId}`),
		cell(sheet, "to-budget"),
	]);
	if (goal == null || goal <= 0) return null;
	const isLongGoal = longGoal === 1;
	return {
		goal,
		isLongGoal,
		budgeted: budgeted ?? 0,
		current: (isLongGoal ? balance : budgeted) ?? 0,
		toBudget,
	};
}
