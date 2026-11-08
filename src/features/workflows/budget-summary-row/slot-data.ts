import { heldForNextMonth, nextMonthGoalNeed } from "@features/workflows/template-plan/overview";
import type { OverviewData } from "@features/workflows/template-plan/state.svelte";
import { loadCategories } from "@lib/template-plan/actual-data";
import { readCells } from "@lib/utilities/budget-cells";
import { addMonths, monthToSheet, sheetToMonth } from "@lib/utilities/months";

/** How many earlier months "usual" averages over. */
export const USUAL_MONTHS = 3;
/** A category must usually take this share of spending to count as the biggest change. */
const CHANGE_FLOOR = 0.03;

function earlierSheets(sheet: string): string[] {
	const month = sheetToMonth(sheet);
	return month
		? Array.from({ length: USUAL_MONTHS }, (_, i) => monthToSheet(addMonths(month, -(i + 1))))
		: [];
}

/** The last result per month, so a month slid back to draws at once. */
function cached<T>() {
	const latest = new Map<string, T>();
	return {
		get: (key: string): T | null => latest.get(key) ?? null,
		set: (key: string, value: T): T => (latest.set(key, value), value),
	};
}

export interface PinnedTotals {
	name: string;
	balance: number;
	spent: number;
	budgeted: number;
}

export const pinnedCache = cached<PinnedTotals | null>();

export async function loadPinned(sheet: string, id: string): Promise<PinnedTotals | null> {
	const [cats, cells] = await Promise.all([
		loadCategories(),
		readCells(sheet, [`leftover-${id}`, `sum-amount-${id}`, `budget-${id}`]),
	]);
	const cat = cats.find((c) => c.id === id);
	return pinnedCache.set(
		`${sheet}:${id}`,
		cat
			? {
					name: cat.name,
					balance: cells.get(`leftover-${id}`) ?? 0,
					spent: Math.abs(cells.get(`sum-amount-${id}`) ?? 0),
					budgeted: cells.get(`budget-${id}`) ?? 0,
				}
			: null,
	);
}

export interface IncomeTotals {
	received: number;
	/** The average of the earlier months that had income; null without any. */
	usual: number | null;
}

export const incomeCache = cached<IncomeTotals>();

export async function loadIncome(sheet: string): Promise<IncomeTotals> {
	const [now, ...before] = await Promise.all(
		[sheet, ...earlierSheets(sheet)].map((s) => readCells(s, ["total-income"])),
	);
	const earlier = before.map((c) => c.get("total-income") ?? 0).filter((n) => n > 0);
	return incomeCache.set(sheet, {
		received: now.get("total-income") ?? 0,
		usual: earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : null,
	});
}

export interface Change {
	name: string;
	/** Spending this month over the usual, as a fraction: 0.38 is 38% more. */
	rise: number;
}

export const changeCache = cached<Change | null>();

/** The spending category furthest above its usual this month, among ones that usually matter. */
export async function loadBiggestChange(sheet: string): Promise<Change | null> {
	const cats = (await loadCategories()).filter((c) => !c.hidden && !c.is_income);
	const names = cats.map((c) => `sum-amount-${c.id}`);
	const [now, ...before] = await Promise.all(
		[sheet, ...earlierSheets(sheet)].map((s) => readCells(s, names)),
	);
	const usual = new Map(
		cats.map((c) => [
			c.id,
			before.reduce((sum, cells) => sum + Math.abs(cells.get(`sum-amount-${c.id}`) ?? 0), 0) /
				USUAL_MONTHS,
		]),
	);
	const floor = [...usual.values()].reduce((a, b) => a + b, 0) * CHANGE_FLOOR;
	let best: Change | null = null;
	for (const c of cats) {
		const typical = usual.get(c.id) ?? 0;
		const spent = Math.abs(now.get(`sum-amount-${c.id}`) ?? 0);
		if (typical <= 0 || typical < floor || spent <= typical) {
			continue;
		}
		const rise = spent / typical - 1;
		if (!best || rise > best.rise) {
			best = { name: c.name, rise };
		}
	}
	return changeCache.set(sheet, best);
}

/** What the Months ahead card spends down: Insights' Next Month figures, by its coverage method. */
export function nextMonthPlan(
	d: OverviewData,
	goalTemplates: boolean,
): { held: number; need: number | null; later: number[] } {
	const typical = d.recentAvgSpending;
	return {
		held: heldForNextMonth(d),
		need: goalTemplates ? nextMonthGoalNeed(d) : typical,
		later: goalTemplates
			? (d.aheadTemplateNeeds ?? [])
			: Array.from({ length: 11 }, () => typical ?? 0),
	};
}
