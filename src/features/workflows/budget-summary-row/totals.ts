import { BALANCE_CELL_RE, fetchCells } from "@features/readability/category-progress/cells";
import { readCell } from "@lib/utilities/budget-cells";
import { loadMonthMoves, movedOutById } from "@lib/utilities/budget-moves";
import { loadCurrency } from "@lib/utilities/currency";
import { addMonths, monthToSheet, sheetToMonth } from "@lib/utilities/months";
import type { Shortfall } from "./actions";
import { LEFTOVER_CELL } from "@lib/actual-dom";

export interface MonthTotals {
	toBudget: number;
	available: number;
	budgeted: number;
	overspent: number;
	nextMonth: number;
	spent: number;
	goals: number;
	funded: number;
	short: Shortfall[];
	/** How much of the targets' shortfall is money moved out of them this month. */
	fromMoves: number;
	/** This month's overspending, which comes out of next month's To Budget. */
	overspentNow: number;
	overIds: string[];
}

/** The last totals per month, in memory only, so switching views can draw them at once. */
const latest = new Map<string, MonthTotals>();

export const cachedTotals = (sheet: string): MonthTotals | null => latest.get(sheet) ?? null;

// Whether the last month loaded had targets, so a reload's placeholder has the row's shape.
const TARGETS_KEY = "abt-summary-has-targets";

export function expectsTargets(): boolean {
	try {
		return localStorage.getItem(TARGETS_KEY) === "1";
	} catch {
		return false;
	}
}

function rememberTargets(has: boolean): void {
	try {
		localStorage.setItem(TARGETS_KEY, has ? "1" : "0");
	} catch {
		// The placeholder just guesses the shape without it.
	}
}

/**
 * The categories the table shows, from any month's balance cells: every month lists the
 * same ones, and the carousel's off-screen months have no cells of their own.
 */
function categoryIds(): string[] {
	const ids = new Set<string>();
	for (const el of document.querySelectorAll(LEFTOVER_CELL)) {
		const match = el.getAttribute("data-cellname")?.match(BALANCE_CELL_RE);
		if (match) {
			ids.add(match[2]);
		}
	}
	return [...ids];
}

/** Targets and overspending, from the category cells both budget types share. */
type CategoryStats = Pick<
	MonthTotals,
	"goals" | "funded" | "short" | "fromMoves" | "overspentNow" | "overIds"
>;

async function categoryStats(sheet: string): Promise<CategoryStats> {
	const ids = categoryIds();
	const cats = (await Promise.all(ids.map((id) => fetchCells(sheet, id)))).map((cells, i) => ({
		...cells,
		id: ids[i],
	}));
	const withGoal = cats.filter((c) => c.hasGoal);
	const over = cats.filter((c) => c.balance < 0);
	const short = withGoal
		.filter((c) => c.goalShortfall > 0)
		.map((c) => ({ id: c.id, shortfall: c.goalShortfall }));
	const month = sheetToMonth(sheet);
	const movedOut =
		short.length && month
			? movedOutById(await loadMonthMoves(month).catch(() => []))
			: new Map<string, number>();
	return {
		goals: withGoal.length,
		funded: withGoal.filter((c) => c.goalShortfall === 0).length,
		short,
		fromMoves: short.reduce((t, c) => t + Math.min(c.shortfall, movedOut.get(c.id) ?? 0), 0),
		overspentNow: over.reduce((sum, c) => sum - c.balance, 0),
		overIds: over.map((c) => c.id),
	};
}

export async function loadMonthTotals(sheet: string): Promise<MonthTotals> {
	await loadCurrency();
	const [toBudget, available, budgeted, overspent, nextMonth, spent] = await Promise.all(
		[
			"to-budget",
			"available-funds",
			"total-budgeted",
			"last-month-overspent",
			"buffered-selected",
			"total-spent",
		].map((name) => readCell(sheet, name, 0)),
	);
	// Actual stores these as negative outflows.
	const totals: MonthTotals = {
		toBudget,
		available,
		budgeted: Math.abs(budgeted),
		overspent: Math.abs(overspent),
		nextMonth: Math.abs(nextMonth),
		spent: Math.abs(spent),
		...(await categoryStats(sheet)),
	};
	latest.set(sheet, totals);
	rememberTargets(totals.goals > 0);
	return totals;
}

/** A tracking budget's month: income and spending against what's budgeted, and the difference. */
export interface TrackingTotals extends CategoryStats {
	income: number;
	incomeBudgeted: number;
	spent: number;
	spentBudgeted: number;
	/** Income less spending so far. */
	saved: number;
	/** Budgeted income less budgeted spending. */
	projected: number;
}

const latestTracking = new Map<string, TrackingTotals>();

export const cachedTrackingTotals = (sheet: string): TrackingTotals | null =>
	latestTracking.get(sheet) ?? null;

export async function loadTrackingTotals(sheet: string): Promise<TrackingTotals> {
	await loadCurrency();
	// The cells Actual's own tracking summary shows.
	const [income, incomeBudgeted, spent, spentBudgeted, saved, projected] = await Promise.all(
		[
			"total-income",
			"total-budget-income",
			"total-spent",
			"total-budgeted",
			"real-saved",
			"total-saved",
		].map((name) => readCell(sheet, name, 0)),
	);
	const totals: TrackingTotals = {
		income,
		incomeBudgeted,
		spent: Math.abs(spent),
		spentBudgeted: Math.abs(spentBudgeted),
		saved,
		projected,
		...(await categoryStats(sheet)),
	};
	latestTracking.set(sheet, totals);
	rememberTargets(totals.goals > 0);
	return totals;
}

/**
 * Loads the months either side, so the card that slides in next draws complete and tinted
 * during the slide rather than popping in once its reads return.
 */
export function prefetchNeighbours(sheet: string, tracking = false): void {
	const month = sheetToMonth(sheet);
	if (!month) {
		return;
	}
	for (const step of [-1, 1]) {
		const next = monthToSheet(addMonths(month, step));
		if (tracking ? latestTracking.has(next) : latest.has(next)) {
			continue;
		}
		(tracking ? loadTrackingTotals(next) : loadMonthTotals(next)).catch(() => {});
	}
}
