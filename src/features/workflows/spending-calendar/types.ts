export interface DayTransaction {
	payee: string;
	amount: number;
	categoryName: string;
	categoryId: string;
	accountName: string;
	notes: string;
	upcoming?: boolean;
	/** The schedule an upcoming or missed bill comes from. */
	scheduleId?: string;
	/** A bill with no account, which the daily balance can't place. */
	outsideBalance?: boolean;
	missed?: boolean;
	/** Between on-budget (or off-budget) accounts, one of them hidden: not spending. */
	transfer?: boolean;
}

export interface DayData {
	date: number;
	iso: string;
	total: number;
	/** Posted spending net of refunds, for the heat tint. */
	spent: number;
	transactions: DayTransaction[];
	/** Closing balance of the selected accounts, when balances are on. */
	balance?: number;
	/** Same as the day before, so it can recede. */
	balanceFlat?: boolean;
	hasMissed: boolean;
	isToday: boolean;
	isFuture: boolean;
	isCurrentMonth: boolean;
}
