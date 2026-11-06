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
