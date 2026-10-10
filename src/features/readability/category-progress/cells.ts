import { send } from "@lib/utilities/actual-api";

// Shared by the progress rings and the balance status pills, so both read one cache.

export const BALANCE_CELL_RE =
	/^(budget\d{6})!leftover-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const CACHE_MS = 15000;

/**
 * React updates a changed balance by rewriting its text node, which a plain
 * childList watcher never sees; observing text too makes pills and rings
 * repaint as soon as a budget edit or assignment lands.
 */
export const BALANCE_WATCH_OPTIONS: MutationObserverInit = {
	childList: true,
	subtree: true,
	characterData: true,
};

export interface CatCells {
	budgeted: number;
	spent: number; // positive cents
	balance: number;
	hasGoal: boolean;
	/** Cents still needed for this month's goal; 0 when there's no goal or it's met. */
	goalShortfall: number;
	fetchedAt: number;
}

const cellCache = new Map<string, CatCells>();
const inflight = new Map<string, { promise: Promise<CatCells>; startedAt: number }>();
/** When each month's cells last changed; anything fetched before then is out of date. */
const staleSince = new Map<string, number>();

/** Marks months whose cells changed, so the next read of them fetches fresh values. */
export function markSheetsStale(sheets: Iterable<string>): void {
	const now = Date.now();
	for (const sheet of sheets) staleSince.set(sheet, now);
}

export async function cellValue(sheet: string, name: string): Promise<number> {
	try {
		const res = await send("get-cell", { sheetName: sheet, name });
		return res && typeof res.value === "number" ? res.value : 0;
	} catch {
		return 0;
	}
}

export function fetchCells(sheet: string, catId: string, force?: boolean): Promise<CatCells> {
	const key = `${sheet}:${catId}`;
	const since = staleSince.get(sheet) ?? 0;
	const cached = cellCache.get(key);
	if (!force && cached && cached.fetchedAt >= since && Date.now() - cached.fetchedAt < CACHE_MS) {
		return Promise.resolve(cached);
	}
	const pending = inflight.get(key);
	if (!force && pending && pending.startedAt >= since) return pending.promise;

	const entry = { startedAt: Date.now() } as { startedAt: number; promise: Promise<CatCells> };
	const { startedAt } = entry;
	entry.promise = (async () => {
		const [budgeted, sumAmount, balance, goal, longGoal] = await Promise.all([
			cellValue(sheet, `budget-${catId}`),
			cellValue(sheet, `sum-amount-${catId}`),
			cellValue(sheet, `leftover-${catId}`),
			cellValue(sheet, `goal-${catId}`),
			cellValue(sheet, `long-goal-${catId}`),
		]);
		// Same rule as Actual's balance pill: long goals compare the balance.
		const funded = longGoal === 1 ? balance : budgeted;
		const data: CatCells = {
			budgeted,
			spent: Math.max(0, -sumAmount),
			balance,
			hasGoal: goal > 0,
			goalShortfall: goal > 0 ? Math.max(0, goal - funded) : 0,
			// When it was requested, so a change during the request still counts as newer.
			fetchedAt: startedAt,
		};
		cellCache.set(key, data);
		// A forced fetch may have replaced this one; only clear our own entry.
		if (inflight.get(key) === entry) inflight.delete(key);
		return data;
	})();
	inflight.set(key, entry);
	return entry.promise;
}

export function clearCellCache(): void {
	cellCache.clear();
}
