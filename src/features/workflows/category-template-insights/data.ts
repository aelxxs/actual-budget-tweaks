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

export function invalidateCache() {
	goalCache.clear();
}

export function resetData() {
	insights = null;
	loading = null;
	goalCache.clear();
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
		return parsed.filter((d): d is GoalDefEntry => d && (d.directive === "template" || d.directive === "goal"));
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
				query<{ id: string; name: string; tombstone: boolean; goal_def: string | null }[]>("categories"),
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

export function scheduleTotalCents(entry: CategoryInsight): number {
	let total = 0;
	for (const { schedule } of entry.linkedSchedules) {
		const amt = parseScheduleAmount(schedule);
		if (amt != null) total += Math.abs(amt);
	}
	return total;
}

const goalCache = new Map<string, number | null>();

function getCurrentSheetName(): string | null {
	const el = document.querySelector('[data-testid^="budget2"][data-testid*="!sum-amount-"]');
	if (!el) return null;
	const m = (el.getAttribute("data-testid") || "").match(/^(budget\d{6})!/);
	return m ? m[1] : null;
}

async function fetchGoalCents(catId: string): Promise<number | null> {
	if (goalCache.has(catId)) return goalCache.get(catId)!;
	const sheet = getCurrentSheetName();
	if (!sheet) return null;
	try {
		const res = await send<{ value?: number }>("get-cell", { sheetName: sheet, name: "goal-" + catId });
		const value = res && typeof res.value === "number" ? res.value : null;
		goalCache.set(catId, value);
		return value;
	} catch {
		return null;
	}
}

async function fetchLeftoverCents(catId: string): Promise<number | null> {
	const sheet = getCurrentSheetName();
	if (!sheet) return null;
	try {
		const res = await send<{ value?: number }>("get-cell", { sheetName: sheet, name: "leftover-" + catId });
		return res && typeof res.value === "number" ? res.value : null;
	} catch {
		return null;
	}
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

/**
 * Derives the goal amount directly from an unambiguous "simple"/monthly
 * "periodic"/"limit"+"refill" directive set, in cents. Returns null for
 * anything else (average, percentage, by, spend, copy, remainder, a
 * non-monthly periodic/limit cadence, or multiple mixed directives) since
 * those targets can only be computed by Actual's budget engine — the caller
 * falls back to the sheet cell in that case.
 */
function directGoalCents(entry: CategoryInsight): number | null {
	const nonSchedule = entry.directives.filter((d) => d.type !== "schedule");

	if (nonSchedule.length === 2) {
		const limit = nonSchedule.find((d) => d.type === "limit");
		const refill = nonSchedule.find((d) => d.type === "refill");
		if (limit?.type === "limit" && refill?.type === "refill" && limit.period === "monthly") {
			return Math.round(limit.amount * 100);
		}
		return null;
	}

	if (nonSchedule.length !== 1) return null;
	const d = nonSchedule[0];
	if (d.type === "simple") {
		if (d.limit) return Math.round(d.limit.amount * 100);
		if (d.monthly != null) return Math.round(d.monthly * 100);
		return null;
	}
	if (d.type === "periodic" && d.period.period === "month" && d.period.amount === 1) {
		return Math.round(d.amount * 100);
	}
	if (d.type === "limit" && d.period === "monthly") {
		return Math.round(d.amount * 100);
	}
	return null;
}

export async function getProgressCents(row: HTMLElement, entry: CategoryInsight): Promise<ProgressInfo> {
	const schedTotal = scheduleTotalCents(entry);
	if (schedTotal > 0) {
		const leftover = await fetchLeftoverCents(entry.id);
		const num = leftover == null ? null : Math.max(0, leftover);
		return { numerator: num, denominator: schedTotal, source: "schedule" };
	}

	// A "goal" directive overrides the indicator to compare the category's
	// current balance (not its budgeted amount) against a target amount.
	const goalDirective = entry.directives.find((d) => d.type === "goal");
	if (goalDirective) {
		const leftover = await fetchLeftoverCents(entry.id);
		const num = leftover == null ? null : Math.max(0, leftover);
		return { numerator: num, denominator: Math.round(goalDirective.amount * 100), source: "goal" };
	}

	const budgetedCents = getBudgetedCents(row);
	const goalCents = directGoalCents(entry) ?? (await fetchGoalCents(entry.id));
	return { numerator: budgetedCents, denominator: goalCents, source: "goal" };
}

export { parseScheduleAmount };
