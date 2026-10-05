import { query } from "@lib/utilities/actual-api";

/** Actual's Settings › Format choices that ABT's dates and calendars follow. */
export interface DatePrefs {
	/** Actual's pattern, e.g. "dd/MM/yyyy" or "yyyy-MM-dd". */
	dateFormat: string;
	/** 0 = Sunday … 6 = Saturday. */
	firstDayOfWeek: number;
}

const DEFAULTS: DatePrefs = { dateFormat: "MM/dd/yyyy", firstDayOfWeek: 0 };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let prefs = $state<DatePrefs>({ ...DEFAULTS });

/**
 * Re-reads the prefs, which are synced per budget and can change in Settings, so callers
 * refresh when they load their own data. Keeps the last known values if the read fails.
 */
export async function loadDatePrefs(): Promise<DatePrefs> {
	try {
		const rows = await query<{ id: string; value: string }[]>("preferences", {
			filter: { id: { $oneof: ["dateFormat", "firstDayOfWeekIdx"] } },
		});
		const value = (id: string) => rows?.find((r) => r.id === id)?.value;
		const day = Number(value("firstDayOfWeekIdx") ?? 0);
		prefs = {
			dateFormat: value("dateFormat") || DEFAULTS.dateFormat,
			firstDayOfWeek: Number.isInteger(day) && day >= 0 && day <= 6 ? day : 0,
		};
	} catch (e) {
		console.warn("[ABT] Failed to read date format:", e);
	}
	return prefs;
}

/** The current prefs; reactive, so markup re-renders once they load. */
export function datePrefs(): DatePrefs {
	return prefs;
}

// "YYYY-MM-DD" parses as UTC midnight with new Date(), which is the previous day west of UTC.
function toDate(value: Date | string): Date {
	if (value instanceof Date) return value;
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/** A full date in the user's format, e.g. 05/10/2026 for dd/MM/yyyy. */
export function formatDate(value: Date | string): string {
	const d = toDate(value);
	return prefs.dateFormat
		.replace("yyyy", String(d.getFullYear()))
		.replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
		.replace("dd", String(d.getDate()).padStart(2, "0"));
}

/** A date with the month named, ordered like the user's format: "5 Oct" or "Oct 5". */
export function formatDayMonth(value: Date | string, month: "short" | "long" = "short"): string {
	const d = toDate(value);
	const name = d.toLocaleString("en-US", { month });
	return prefs.dateFormat.startsWith("dd") ? `${d.getDate()} ${name}` : `${name} ${d.getDate()}`;
}

/** Short weekday names starting from the given first day of the week. */
export function weekdayNames(firstDayOfWeek: number): string[] {
	return [...WEEKDAYS.slice(firstDayOfWeek), ...WEEKDAYS.slice(0, firstDayOfWeek)];
}
