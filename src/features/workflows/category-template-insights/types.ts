export interface ParsedTemplate {
	priority: number | null;
	raw: string;
	scheduleName: string | null;
}

export interface LinkedSchedule {
	template: ParsedTemplate;
	schedule: RawSchedule;
	paid: boolean;
	paidDate: string | null;
}

export interface CategoryInsight {
	id: string;
	name: string;
	templates: ParsedTemplate[];
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
