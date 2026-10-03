export interface DayTransaction {
	payee: string;
	amount: number;
	categoryName: string;
	categoryId: string;
	accountName: string;
	notes: string;
	upcoming?: boolean;
	missed?: boolean;
}

export interface DayData {
	date: number;
	iso: string;
	total: number;
	/** Posted outflows only, for the heat tint. */
	spent: number;
	transactions: DayTransaction[];
	hasMissed: boolean;
	isToday: boolean;
	isFuture: boolean;
	isCurrentMonth: boolean;
}
