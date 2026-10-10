import { readCell } from "@lib/utilities/budget-cells";

export interface GoalState {
	goal: number;
	/** Long goals (#goal) compare the balance; templates compare the budgeted amount. */
	isLongGoal: boolean;
	budgeted: number;
	current: number;
	toBudget: number | null;
}

// Mirrors Actual's own balance pill, so "needed" matches its underfunded state.
export async function loadGoalState(sheet: string, categoryId: string): Promise<GoalState | null> {
	const [goal, longGoal, budgeted, balance, toBudget] = await Promise.all([
		readCell(sheet, `goal-${categoryId}`),
		readCell(sheet, `long-goal-${categoryId}`),
		readCell(sheet, `budget-${categoryId}`),
		readCell(sheet, `leftover-${categoryId}`),
		readCell(sheet, "to-budget"),
	]);
	if (goal == null || goal <= 0) {
		return null;
	}
	const isLongGoal = longGoal === 1;
	return {
		goal,
		isLongGoal,
		budgeted: budgeted ?? 0,
		current: (isLongGoal ? balance : budgeted) ?? 0,
		toBudget,
	};
}
