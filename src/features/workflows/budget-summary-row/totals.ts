import { BALANCE_CELL_RE, fetchCells } from "@features/readability/category-progress/cells";
import { readCell } from "@lib/actual/budget-cells";
import { loadMonthMoves, movedOutById } from "@lib/actual/budget-moves";
import { loadCurrency } from "@lib/format/currency";
import { addMonths, currentMonth, monthToSheet, sheetToMonth } from "@lib/format/months";
import { loadCategories } from "@lib/actual/templates/actual-data";
import { previewMonthTemplates } from "@lib/actual/templates/next-month-coverage";
import { templatesEnabled, type Shortfall } from "./actions";
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
	/** A past month whose shortfall is all money moved out, e.g. to cover overspending: done, not short. */
	settled: boolean;
	/** This month's overspending, which comes out of next month's To Budget. */
	overspentNow: number;
	overIds: string[];
	/** What Apply would assign; 0 without templates or To Budget. */
	toApply: number;
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
	"goals" | "funded" | "short" | "fromMoves" | "settled" | "overspentNow" | "overIds"
>;

async function categoryStats(sheet: string): Promise<CategoryStats> {
	const ids = categoryIds();
	// Fresh reads: Apply can clear a goal without changing any cell the table shows, so the
	// shared cache wouldn't know (a refill category whose balance already covers its cap).
	const cats = (await Promise.all(ids.map((id) => fetchCells(sheet, id, true)))).map(
		(cells, i) => ({
			...cells,
			id: ids[i],
		}),
	);
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
	const fromMoves = short.reduce((t, c) => t + Math.min(c.shortfall, movedOut.get(c.id) ?? 0), 0);
	const settled =
		!!month &&
		month < currentMonth() &&
		short.length > 0 &&
		fromMoves >= short.reduce((t, c) => t + c.shortfall, 0);
	return {
		goals: withGoal.length,
		funded: settled ? withGoal.length : withGoal.filter((c) => c.goalShortfall === 0).length,
		short: settled ? [] : short,
		fromMoves,
		settled,
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
		toApply: toBudget > 0 ? await applyAmount(sheet) : 0,
	};
	latest.set(sheet, totals);
	rememberTargets(totals.goals > 0);
	return totals;
}

/**
 * What Apply would assign, worked out with the rest so a month's suggestion is ready when its
 * card draws. Goal cells can't tell this: Actual can set them with nothing budgeted
 * (actualbudget/actual#9304).
 */
async function applyAmount(sheet: string): Promise<number> {
	const month = sheetToMonth(sheet);
	if (!month || !(await templatesEnabled())) {
		return 0;
	}
	const cats = (await loadCategories()).filter((c) => !c.hidden);
	return (await previewMonthTemplates(month, cats))?.onApply ?? 0;
}

/** A tracking budget's month: income and spending against what's budgeted, and the difference. */
export interface TrackingTotals extends CategoryStats {
	income: number;
	incomeBudgeted: number;
	spent: number;
	spentBudgeted: number;
	/** What the current month's templates would assign, whether or not income has arrived. */
	toApply: number;
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
		toApply: await applyAmount(sheet),
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
