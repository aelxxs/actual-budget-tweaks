import { formatDayMonth } from "@lib/utilities/date-format.svelte";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 365 * 24 * 3600e3],
	["month", 30 * 24 * 3600e3],
	["week", 7 * 24 * 3600e3],
	["day", 24 * 3600e3],
	["hour", 3600e3],
	["minute", 60e3],
];

export function relativeTime(ms: number): string {
	const diff = ms - Date.now();
	const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	for (const [unit, size] of UNITS) {
		if (Math.abs(diff) >= size) {
			return format.format(Math.round(diff / size), unit);
		}
	}
	return "just now";
}

export function compactAge(days: number): string {
	if (days < 1) {
		return "today";
	}
	if (days < 30) {
		return `${Math.floor(days)}d`;
	}
	if (days < 365) {
		return `${Math.floor(days / 30)}mo`;
	}
	return `${Math.floor(days / 365)}y`;
}

/** "Oct 6 · 33 days ago": the date, so it can be found on a statement, then how long since. */
export function reconciledOn(ms: number): string {
	const when = new Date(ms);
	const now = new Date();
	const date = formatDayMonth(when);
	const shown = when.getFullYear() === now.getFullYear() ? date : `${date}, ${when.getFullYear()}`;
	const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const days = Math.round((midnight(now) - midnight(when)) / (24 * 3600e3));
	const ago =
		days <= 0
			? "today"
			: days === 1
				? "yesterday"
				: days < 60
					? `${days} days ago`
					: relativeTime(ms);
	return `${shown} · ${ago}`;
}
