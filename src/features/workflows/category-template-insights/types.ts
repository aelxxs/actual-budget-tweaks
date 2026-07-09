import type { GoalDefEntry } from "@lib/types/actual-schema";

export interface LinkedSchedule {
	directive: Extract<GoalDefEntry, { type: "schedule" }>;
	schedule: RawSchedule;
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
}

export interface ProgressInfo {
	numerator: number | null;
	denominator: number | null;
	source: "schedule" | "goal";
}
