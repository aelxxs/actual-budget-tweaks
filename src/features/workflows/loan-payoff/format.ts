import { parseMonth } from "@lib/format/months";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MONTH_NAMES: readonly string[] = MONTHS;

/** "Jun 2028" for "2028-06". */
export function monthName(key: string): string {
	const { year, month } = parseMonth(key);
	return `${MONTHS[month]} ${year}`;
}

/** A count of monthly payments as "1y 7m". */
export function span(payments: number): string {
	const years = Math.floor(payments / 12);
	const months = payments % 12;
	return [years ? `${years}y` : "", months || !years ? `${months}m` : ""].filter(Boolean).join(" ");
}
