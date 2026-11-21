import { heldForNextMonth, nextMonthGoalNeed } from "@features/workflows/template-plan/overview";
import type { OverviewData } from "@features/workflows/template-plan/state.svelte";
import { calculate } from "@lib/actual/actual-api";
import { loadCategories } from "@lib/actual/templates/actual-data";
import { readCells } from "@lib/actual/budget-cells";
import { addMonths, currentMonth, monthToSheet, sheetToMonth } from "@lib/format/months";
import { GROUP_PIN } from "./slots";

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

/** A category's totals, or a group's (pinned as `group:<id>`) from Actual's group cells. */
export async function loadPinned(sheet: string, pinned: string): Promise<PinnedTotals | null> {
	const group = pinned.startsWith(GROUP_PIN) ? pinned.slice(GROUP_PIN.length) : null;
	const id = group ?? pinned;
	const prefix = group ? "group-" : "";
	const [cats, cells] = await Promise.all([
		loadCategories(),
		readCells(sheet, [
			`${prefix}leftover-${id}`,
			`${prefix}sum-amount-${id}`,
			`${prefix}budget-${id}`,
		]),
	]);
	const name = group
		? cats.find((c) => c.group_id === group)?.group_name
		: cats.find((c) => c.id === id)?.name;
	return pinnedCache.set(
		`${sheet}:${pinned}`,
		name
			? {
					name,
					balance: cells.get(`${prefix}leftover-${id}`) ?? 0,
					spent: Math.abs(cells.get(`${prefix}sum-amount-${id}`) ?? 0),
					budgeted: cells.get(`${prefix}budget-${id}`) ?? 0,
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

export interface SpentCompare {
	/** What last month had spent by the same point: its same day, or all of it for a past month. */
	before: number;
	/** Last month, e.g. "Oct". */
	month: string;
	/** The day compared up to, while this month is still running. */
	day: number | null;
}

export const compareCache = cached<SpentCompare | null>();

const shortMonth = (key: string) => {
	const [y, m] = key.split("-").map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
};

/**
 * Spending against last month: by the same day while this month runs, in full once it's over.
 * Past data, not a forecast, and bills paid on the same date each month cancel out.
 */
export async function loadSpentCompare(
	sheet: string,
	today = new Date(),
): Promise<SpentCompare | null> {
	const month = sheetToMonth(sheet);
	const now = currentMonth();
	if (!month || month > now) {
		return compareCache.set(sheet, null);
	}
	const prev = addMonths(month, -1);
	let before: number;
	let day: number | null = null;
	if (month === now) {
		const [y, m] = prev.split("-").map(Number);
		day = Math.min(today.getDate(), new Date(y, m, 0).getDate());
		// What Actual counts as spent: budgeted, non-income categories, split children not parents.
		const sum = await calculate<number | null>(
			"transactions",
			{ $sum: "$amount" },
			{
				filter: {
					// One operator per field: AQL drops the rest of `{ $gte, $lte }`.
					$and: [
						{ date: { $gte: `${prev}-01` } },
						{ date: { $lte: `${prev}-${String(day).padStart(2, "0")}` } },
					],
					"account.offbudget": false,
					// Spending is categorised: transfers and uncategorised rows aren't in Actual's Spent.
					category: { $ne: null },
					"category.is_income": false,
				},
				options: { splits: "inline" },
			},
		);
		before = Math.abs(sum ?? 0);
	} else {
		const cells = await readCells(monthToSheet(prev), ["total-spent"]);
		before = Math.abs(cells.get("total-spent") ?? 0);
	}
	return compareCache.set(sheet, before > 0 ? { before, month: shortMonth(prev), day } : null);
}

/** How far through the month today is, 0 to 1, for the month being shown now; null for any other. */
export function monthElapsed(sheet: string, today = new Date()): number | null {
	if (sheetToMonth(sheet) !== currentMonth()) {
		return null;
	}
	const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
	return today.getDate() / days;
}

export const heldCache = cached<number>();

/** What's left across the categories: the budget table's Balance total. */
export async function loadHeld(sheet: string): Promise<number> {
	const cells = await readCells(sheet, ["total-leftover"]);
	return heldCache.set(sheet, cells.get("total-leftover") ?? 0);
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
