/*
 * Budget months as Actual names them: "2026-10" for a month, `budget202610` for its sheet.
 * Everything is local time; toISOString() would give tomorrow's date in the evening west of UTC.
 */

/** "2026-10" for a year and a 0-based month; months past either end roll into the next year. */
export function monthKey(year: number, month: number): string {
	const d = new Date(year, month, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const monthOf = (date: Date): string => monthKey(date.getFullYear(), date.getMonth());

export const currentMonth = (): string => monthOf(new Date());

export function parseMonth(key: string): { year: number; month: number } {
	const [year, month] = key.split("-").map(Number);
	return { year, month: month - 1 };
}

export function addMonths(key: string, n: number): string {
	const { year, month } = parseMonth(key);
	return monthKey(year, month + n);
}

export const monthToSheet = (key: string): string => `budget${key.replace("-", "")}`;

export function sheetToMonth(sheet: string): string | null {
	const m = sheet.match(/^budget(\d{4})(\d{2})/);
	return m ? `${m[1]}-${m[2]}` : null;
}

/** "2026-10-09" for a date, in local time. */
export function isoDate(date: Date = new Date()): string {
	return `${monthOf(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "2026-10-09" for `n` days before today (after, for a negative `n`). */
export function isoDaysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return isoDate(d);
}
