import type { GoalDefEntry } from "@lib/types/actual-schema";

/** Actual's own schedule statuses (`getStatus`), so ABT's colours match its schedule icon. */
export type ScheduleStatus = "completed" | "paid" | "due" | "upcoming" | "missed" | "scheduled";

export interface LinkedSchedule {
	directive: Extract<GoalDefEntry, { type: "schedule" }>;
	schedule: RawSchedule;
	status: ScheduleStatus;
	paid: boolean;
	paidDate: string | null;
}

export interface CategoryInsight {
	id: string;
	name: string;
	directives: GoalDefEntry[];
	linkedSchedules: LinkedSchedule[];
}

export interface RawSchedule {
	id: string;
	name: string;
	next_date: string;
	completed: boolean;
	tombstone: boolean;
	_payee: string;
	_account: string;
	_amount: unknown;
	/** A date string for a one-off, or a recurrence config with `frequency` and `interval`. */
	_date: unknown;
}

export interface ProgressInfo {
	numerator: number | null;
	denominator: number | null;
	/** A #goal, met by the balance; everything else is met by this month's budget. */
	isLongGoal: boolean;
}
