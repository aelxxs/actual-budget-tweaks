export interface DayTransaction {
	payee: string;
	amount: number;
	categoryName: string;
	categoryId: string;
	accountName: string;
	notes: string;
	upcoming?: boolean;
}
