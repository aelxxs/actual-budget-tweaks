import { send } from "./actual-api";
import { isBulkEditing, onBulkEditEnd } from "./bulk-edit";
import { watchElement } from "./dom-watcher";
import { UUID } from "./ids";
import { monthToSheet } from "./months";

/*
 * One observer on the budget table for every feature that follows its cells. Each batch says
 * which months are shown and which months' cells changed, from the cells' names (`budget202609!...`).
 */
const BUDGET_TABLE = '[data-testid="budget-table"]';
// Actual's month header, which the month header feature hides but leaves mounted.
const SHOWN_MONTH = '[data-testid="selected-budget-month"][data-month]';
const SHEET_RE = /^(budget\d{6})!/;
const ROW_CATEGORY_RE = new RegExp(`(${UUID})`);

export interface BudgetTableChange {
	table: HTMLElement;
	/** The months shown, as sheet names, left to right. */
	shown: string[];
	/** The shown months changed: navigating, changing how many show, or a new table. */
	moved: boolean;
	/** Months with a cell that changed value; navigating alone changes none. */
	changed: Set<string>;
}

type Listener = (change: BudgetTableChange) => void;

const listeners = new Set<Listener>();
let watched: { table: HTMLElement; observer: MutationObserver; shown: string[] } | null = null;
let stopFinding: (() => void) | null = null;

/** The category a budget table row is for, from its cells' test ids; null for groups and headers. */
export function rowCategoryId(row: Element): string | null {
	const cell = row.querySelector('[data-testid*="sum-amount-"], [data-testid*="leftover-"]');
	return cell?.getAttribute("data-testid")?.match(ROW_CATEGORY_RE)?.[1] ?? null;
}

/** A cell's number, or `fallback` (null unless given) when it's empty or the read fails. */
export async function readCell<F extends number | null = null>(
	sheet: string,
	name: string,
	fallback: F = null as F,
): Promise<number | F> {
	try {
		const res = await send<{ value?: unknown }>("get-cell", { sheetName: sheet, name });
		return typeof res?.value === "number" ? res.value : fallback;
	} catch {
		return fallback;
	}
}

/** Several cells of one sheet, each read as 0 when it's empty or the read fails. */
export async function readCells(sheet: string, names: string[]): Promise<Map<string, number>> {
	const values = await Promise.all(names.map((name) => readCell(sheet, name, 0)));
	return new Map(names.map((name, i) => [name, values[i]]));
}

export function shownSheets(table: Element): string[] {
	const header = table.parentElement ?? table;
	return [...header.querySelectorAll<HTMLElement>(SHOWN_MONTH)].map((cell) =>
		monthToSheet(cell.dataset.month!),
	);
}

/**
 * The months a batch touched: an edit rewrites its own and later months' balances, and
 * navigating adds the new months' cells.
 */
function sheetsInMutations(records: MutationRecord[], movedFrom: string[] | null): Set<string> {
	const sheets = new Set<string>();
	const add = (el: Element | null | undefined) => {
		// ABT's own overlays inside Actual's cells (the rolling To Budget) aren't data changes.
		if (el?.closest("[data-abt-owned]")) {
			return;
		}
		const match = el?.closest("[data-cellname]")?.getAttribute("data-cellname")?.match(SHEET_RE);
		if (match) {
			sheets.add(match[1]);
		}
	};
	for (const record of records) {
		const target = record.target;
		add(target instanceof Element ? target : target.parentElement);
		for (const node of record.addedNodes) {
			if (!(node instanceof Element)) {
				continue;
			}
			add(node);
			for (const cell of node.querySelectorAll("[data-cellname]")) {
				add(cell);
			}
		}
	}
	// Navigating reuses Actual's columns, rewriting months that stay on screen without
	// changing their values; only the months coming into view are new.
	if (movedFrom) {
		for (const sheet of movedFrom) {
			sheets.delete(sheet);
		}
	}
	return sheets;
}

function emit(change: BudgetTableChange): void {
	for (const listener of listeners) {
		listener(change);
	}
}

function attach(): void {
	const table = document.querySelector<HTMLElement>(BUDGET_TABLE);
	// Kept while the table is gone (the calendar hides the page), so listeners see it detach.
	if (!table || table === watched?.table) {
		return;
	}
	watched?.observer.disconnect();
	const observer = new MutationObserver((records) => {
		if (!watched) {
			return;
		}
		const shown = shownSheets(table);
		const moved = shown.join() !== watched.shown.join();
		const changed = sheetsInMutations(records, moved ? watched.shown : null);
		watched.shown = shown;
		emit({ table, shown, moved, changed });
	});
	// Navigating rewrites the cells' test ids and the header's months in place; edits rewrite text.
	observer.observe(table.parentElement ?? table, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ["data-testid", "data-month"],
	});
	const shown = shownSheets(table);
	watched = { table, observer, shown };
	emit({ table, shown, moved: true, changed: new Set() });
}

/**
 * Calls `listener` for each batch of changes to the budget table, before the next paint, and
 * once with `moved` whenever a new table appears. Returns an unsubscribe.
 */
export function watchBudgetTable(listener: Listener): () => void {
	listeners.add(listener);
	if (!stopFinding) {
		stopFinding = watchElement(BUDGET_TABLE, attach);
		attach();
	} else if (watched?.table.isConnected) {
		listener({ table: watched.table, shown: watched.shown, moved: true, changed: new Set() });
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size) {
			return;
		}
		stopFinding?.();
		stopFinding = null;
		watched?.observer.disconnect();
		watched = null;
	};
}

/**
 * Gathers changed months until edits pause for `ms`, then hands them over at once. A bulk edit
 * is handed over once, when it finishes.
 */
export function collectChanges(ms: number, flush: (sheets: Set<string>) => void) {
	const pending = new Set<string>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const run = () => {
		if (isBulkEditing() || !pending.size) {
			return;
		}
		const sheets = new Set(pending);
		pending.clear();
		flush(sheets);
	};
	const stopBulk = onBulkEditEnd(run);
	return {
		add(sheets: Iterable<string>) {
			for (const sheet of sheets) {
				pending.add(sheet);
			}
			clearTimeout(timer);
			timer = setTimeout(run, ms);
		},
		/** Drops what's gathered, for a caller that just read everything anyway. */
		cancel() {
			clearTimeout(timer);
			pending.clear();
		},
		stop() {
			clearTimeout(timer);
			pending.clear();
			stopBulk();
		},
	};
}
