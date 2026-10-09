import { query, send } from "@lib/utilities/actual-api";
import type { GoalDefEntry } from "@lib/types/actual-schema";
import type { CategoryInsight, LinkedSchedule, ProgressInfo, RawSchedule } from "./types";

let insights: Map<string, CategoryInsight> | null = null;
let loading: Promise<Map<string, CategoryInsight> | null> | null = null;
const categoryNameById = new Map<string, string>();

export function getInsights() {
	return insights;
}

/** Resolves a category id referenced by a "percentage" directive's `category` field. */
export function getCategoryName(id: string): string | null {
	return categoryNameById.get(id) ?? null;
}

export function resetData() {
	insights = null;
	loading = null;
}

/**
 * `goal_def` is the structured form of a category's template/goal directives —
 * the same data Actual itself parses from notes today, and the only source
 * once Actual's template UI migration drops note-based authoring entirely.
 */
function parseGoalDef(goalDef: string | null | undefined): GoalDefEntry[] {
	if (!goalDef) return [];
	try {
		const parsed = JSON.parse(goalDef);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(d): d is GoalDefEntry => d && (d.directive === "template" || d.directive === "goal"),
		);
	} catch {
		return [];
	}
}

function parseScheduleAmount(schedule: RawSchedule): number | null {
	const raw = schedule._amount;
	if (raw == null) return null;
	if (typeof raw === "number") return raw;
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw);
			if (typeof parsed === "number") return parsed;
			if (parsed && typeof parsed.num === "number") return parsed.num;
		} catch {
			const n = parseFloat(raw);
			if (Number.isFinite(n)) return Math.round(n * 100);
		}
	}
	if (typeof raw === "object" && raw !== null) {
		const obj = raw as Record<string, unknown>;
		if (typeof obj.num === "number") return obj.num;
	}
	return null;
}

function todayIso(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeUpcomingThreshold(todayStr: string, pref: string): string {
	const [y, m, d] = todayStr.split("-").map(Number);
	const iso = (dt: Date) =>
		`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

	const raw = (pref || "7").toString().trim();
	if (raw === "currentMonth") return iso(new Date(y, m, 0));
	if (raw === "oneMonth") return iso(new Date(y, m, d));
	if (raw.includes("-")) {
		const [nStr, unit] = raw.split("-");
		const n = parseInt(nStr, 10);
		if (Number.isFinite(n)) {
			if (unit === "day") return iso(new Date(y, m - 1, d + n));
			if (unit === "week") return iso(new Date(y, m - 1, d + n * 7));
			if (unit === "month") return iso(new Date(y, m - 1 + n, d));
			if (unit === "year") return iso(new Date(y + n, m - 1, d));
		}
	}
	const n = parseInt(raw, 10);
	const days = Number.isFinite(n) ? n : 7;
	return iso(new Date(y, m - 1, d + days));
}

export async function loadData(): Promise<Map<string, CategoryInsight> | null> {
	if (insights) return insights;
	if (loading) return loading;
	loading = (async () => {
		try {
			const [cats, scheds, txs, prefs] = await Promise.all([
				query<{ id: string; name: string; tombstone: boolean; goal_def: string | null }[]>(
					"categories",
				),
				query<RawSchedule[]>("schedules"),
				query<{ id: string; date: string; schedule: string }[]>("transactions", {
					filter: { tombstone: false },
				}),
				query<{ id: string; value: string }[]>("preferences", {
					filter: { id: "upcomingScheduledTransactionLength" },
				}),
			]);

			const upcomingPref = prefs?.[0]?.value || "7";
			categoryNameById.clear();
			for (const c of cats) categoryNameById.set(c.id, c.name);
			const schedsByName = new Map<string, RawSchedule>();
			for (const s of scheds) {
				if (s.name) schedsByName.set(s.name.trim().toLowerCase(), s);
			}

			const today = todayIso();
			const thresholdIso = computeUpcomingThreshold(today, upcomingPref);

			const lastTxBySchedule = new Map<string, string>();
			for (const tx of txs) {
				if (!tx.schedule || !tx.date) continue;
				const prev = lastTxBySchedule.get(tx.schedule);
				if (!prev || tx.date > prev) lastTxBySchedule.set(tx.schedule, tx.date);
			}

			const paidInfo = new Map<string, string>();
			for (const s of scheds) {
				const last = lastTxBySchedule.get(s.id);
				if (!last || last > today) continue;
				if (!s.next_date) continue;
				if (s.next_date > thresholdIso) paidInfo.set(s.id, last);
			}

			const result = new Map<string, CategoryInsight>();
			for (const c of cats) {
				if (c.tombstone) continue;
				const directives = parseGoalDef(c.goal_def);
				if (directives.length === 0) continue;

				const linkedSchedules: LinkedSchedule[] = [];
				for (const d of directives) {
					if (d.type !== "schedule") continue;
					const s = schedsByName.get(d.name.trim().toLowerCase());
					if (s) {
						linkedSchedules.push({
							directive: d,
							schedule: s,
							paid: paidInfo.has(s.id),
							paidDate: paidInfo.get(s.id) || null,
						});
					}
				}
				result.set(c.id, { id: c.id, name: c.name, directives, linkedSchedules });
			}

			insights = result;
			return insights;
		} catch (err) {
			loading = null;
			console.error("[ABT CTI] Failed to load data:", err);
			return null;
		}
	})();
	return loading;
}

export function getCurrentSheetName(): string | null {
	const el = document.querySelector('[data-testid^="budget2"][data-testid*="!sum-amount-"]');
	if (!el) return null;
	const m = (el.getAttribute("data-testid") || "").match(/^(budget\d{6})!/);
	return m ? m[1] : null;
}

async function fetchCell(sheet: string, name: string): Promise<number | null> {
	try {
		const res = await send<{ value?: unknown }>("get-cell", { sheetName: sheet, name });
		return typeof res?.value === "number" ? res.value : null;
	} catch {
		return null;
	}
}

/**
 * Actual's own target for one month: `goal` is what the templates ask for, `long-goal` marks a
 * #goal, which is met by the balance rather than by the month's budget.
 */
export interface MonthValues {
	sheet: string;
	cells: Map<string, { goal: number | null; isLongGoal: boolean; balance: number | null }>;
}

export async function loadMonthValues(sheet: string, ids: Iterable<string>): Promise<MonthValues> {
	const cells: MonthValues["cells"] = new Map();
	await Promise.all(
		[...ids].map(async (id) => {
			const [goal, longGoal, balance] = await Promise.all([
				fetchCell(sheet, `goal-${id}`),
				fetchCell(sheet, `long-goal-${id}`),
				fetchCell(sheet, `leftover-${id}`),
			]);
			cells.set(id, { goal, isLongGoal: longGoal === 1, balance });
		}),
	);
	return { sheet, cells };
}

function getBudgetedCents(row: HTMLElement): number | null {
	const el = row.querySelector('[data-testid="budget"]');
	if (!el) return null;
	const cn = el.getAttribute("data-cellname");
	if (cn != null && /^-?\d+$/.test(cn)) return parseInt(cn, 10);
	const text = (el.textContent || "").replace(/[^\d.-]/g, "");
	const n = parseFloat(text);
	if (!Number.isFinite(n)) return null;
	return Math.round(n * 100);
}

/** How far the month's budget meets the templates, measured the way Actual colours the balance. */
export function progressFor(
	row: HTMLElement,
	entry: CategoryInsight,
	values: MonthValues | null,
): ProgressInfo {
	const cell = values?.cells.get(entry.id);
	if (!cell || cell.goal == null || cell.goal <= 0) {
		return { numerator: null, denominator: null, isLongGoal: cell?.isLongGoal ?? false };
	}
	const numerator = cell.isLongGoal ? cell.balance : getBudgetedCents(row);
	return {
		numerator: numerator == null ? null : Math.max(0, numerator),
		denominator: cell.goal,
		isLongGoal: cell.isLongGoal,
	};
}

export { parseScheduleAmount };

export type ProgressState = "under" | "near" | "full" | "paid";

export function progressState(entry: CategoryInsight, ratio: number): ProgressState {
	if (entry.linkedSchedules.length > 0 && entry.linkedSchedules.every((ls) => ls.paid))
		return "paid";
	if (ratio >= 1) return "full";
	if (ratio >= 0.8) return "near";
	return "under";
}
