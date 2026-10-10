import {
	BALANCE_CELL_RE,
	fetchCells,
	markSheetsStale,
} from "@features/readability/category-progress/cells";
import { defineSetting } from "@features/types";
import { isCalendarOpen } from "@features/workflows/spending-calendar";
import {
	type BudgetTableChange,
	collectChanges,
	shownSheets,
	watchBudgetTable,
} from "@lib/utilities/budget-cells";
import { watchDom, watchElement } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import FilterControl from "./FilterControl.svelte";
import { filterState, type CategoryFilter } from "./state.svelte";

const HIDDEN_ATTR = "data-abt-filter-hidden";
const CONTROL_ATTR = "data-abt-category-filter";
const HEADER_SLOT = "[data-abt-month-header-slot]";
const REFRESH_MS = 250;

let control: Mounted | null = null;
// The table sync() last set up on the budget page; its edits refresh the counts.
let tableShown: HTMLElement | null = null;
let changes: ReturnType<typeof collectChanges> | null = null;
let shownKey = "";
/**
 * The rows the active filter shows, fixed when it's picked: funding a category under
 * "Needs attention" shouldn't make its row vanish mid-edit.
 */
let visible: Set<string> | null = null;
let runSeq = 0;
let pendingEdit: MutationObserver | null = null;

interface Status {
	attention: boolean;
	funded: boolean;
}

/** The id of a category row, from its balance cell; null for groups, income, and headers. */
function rowCategory(row: Element): string | null {
	const cell = row.querySelector('[data-cellname*="!leftover-"]');
	return cell?.getAttribute("data-cellname")?.match(BALANCE_CELL_RE)?.[2] ?? null;
}

const isExpenseGroup = (row: Element) =>
	!!row.querySelector('[data-testid="balance"]') &&
	!row.querySelector('[data-testid="category-name"]');

/** A category matches in any shown month, so multi-month views keep the same rows. */
async function loadStatuses(table: HTMLElement): Promise<Map<string, Status>> {
	const ids = new Set<string>();
	for (const row of table.querySelectorAll('[data-testid="row"]')) {
		const id = rowCategory(row);
		if (id) {
			ids.add(id);
		}
	}
	const sheets = shownSheets(table);
	const statuses = new Map<string, Status>();
	await Promise.all(
		[...ids].map(async (id) => {
			const months = await Promise.all(sheets.map((s) => fetchCells(s, id)));
			const attention = months.some((c) => c.balance < 0 || c.goalShortfall > 0);
			const funded =
				!attention && months.some((c) => (c.hasGoal ? c.goalShortfall === 0 : c.balance > 0));
			statuses.set(id, { attention, funded });
		}),
	);
	return statuses;
}

function countStatuses(statuses: Map<string, Status>): void {
	let attention = 0;
	let funded = 0;
	for (const s of statuses.values()) {
		if (s.attention) {
			attention++;
		}
		if (s.funded) {
			funded++;
		}
	}
	if (attention !== filterState.counts.attention || funded !== filterState.counts.funded) {
		filterState.counts = { attention, funded };
	}
}

function matching(statuses: Map<string, Status>, filter: CategoryFilter): Set<string> {
	const ids = new Set<string>();
	for (const [id, s] of statuses) {
		if (filter === "funded" ? s.funded : s.attention) {
			ids.add(id);
		}
	}
	return ids;
}

function setHidden(row: Element, hidden: boolean): void {
	// Actual wraps each row in its own box; hiding the box drops its spacing too.
	const box = row.parentElement?.childElementCount === 1 ? row.parentElement : row;
	if (box.hasAttribute(HIDDEN_ATTR) !== hidden) {
		box.toggleAttribute(HIDDEN_ATTR, hidden);
	}
}

function applyRows(table: HTMLElement): void {
	const rows = [...table.querySelectorAll('[data-testid="row"]')];
	if (!visible) {
		for (const row of rows) {
			setHidden(row, false);
		}
		return;
	}
	let group: { row: Element; children: number; shown: number } | null = null;
	const closeGroup = () => {
		// A collapsed group's categories aren't rendered, so it can't be ruled out.
		if (group) {
			setHidden(group.row, group.children > 0 && group.shown === 0);
		}
		group = null;
	};
	for (const row of rows) {
		const id = rowCategory(row);
		if (id) {
			const show = visible.has(id);
			setHidden(row, !show);
			if (group) {
				group.children++;
				if (show) {
					group.shown++;
				}
			}
		} else if (isExpenseGroup(row)) {
			closeGroup();
			group = { row, children: 0, shown: 0 };
		} else {
			// Income and its headers have no balance to filter on.
			closeGroup();
			setHidden(row, true);
		}
	}
	closeGroup();
}

async function refresh(table: HTMLElement, refreeze: boolean): Promise<void> {
	const seq = ++runSeq;
	const statuses = await loadStatuses(table);
	if (seq !== runSeq) {
		return;
	}
	countStatuses(statuses);
	if (refreeze) {
		visible = filterState.filter === "all" ? null : matching(statuses, filterState.filter);
		// A filter that matches nothing (say, after moving to a tidy month) would blank the table.
		if (visible?.size === 0) {
			visible = null;
			filterState.filter = "all";
		}
	}
	applyRows(table);
}

function pick(filter: CategoryFilter): void {
	const table = document.querySelector<HTMLElement>('[data-testid="budget-table"]');
	filterState.filter = filter;
	if (!table) {
		return;
	}
	void refresh(table, true);
}

/** In the month header like the mockup when it's on, else in the category column header. */
function mountControl(table: HTMLElement): void {
	const slot = document.querySelector(HEADER_SLOT);
	const bar = table.querySelector('[data-testid="budget-totals"]')?.firstElementChild;
	const parent = slot ?? bar;
	if (!parent || control?.node.parentElement === parent) {
		return;
	}
	unmountControl();
	control = mountToNodeWithReturn(FilterControl, {
		onpick: pick,
		size: slot ? "md" : "sm",
	});
	const { node } = control;
	node.setAttribute(CONTROL_ATTR, "");
	if (slot) {
		slot.append(node);
	}
	// Before ABT's view options when present, else before Actual's ⋮ menu.
	else {
		bar!.insertBefore(node, bar!.querySelector(".abt-view-options") ?? bar!.lastElementChild);
	}
}

function unmountControl(): void {
	if (!control) {
		return;
	}
	control.destroy();
	control = null;
}

// Edits change the counts; the shown rows stay until another filter is picked.
function onTableChange({ table, shown, changed }: BudgetTableChange): void {
	if (table !== tableShown) {
		return;
	}
	markSheetsStale(changed);
	// Only edits to a shown month change the counts; navigating is handled by sync().
	if ([...changed].some((sheet) => shown.includes(sheet))) {
		changes?.add(changed);
	}
}

/** Drag-to-reorder would drop categories among rows the filter hides. */
function blockDrag(e: DragEvent): void {
	if (visible && (e.target as Element | null)?.closest?.('[data-testid="budget-table"]')) {
		e.preventDefault();
		e.stopPropagation();
	}
}

const isHiddenRow = (row: Element) => !!row.closest(`[${HIDDEN_ATTR}]`);

/** Actual's cells open on a press, not a click. */
function press(el: Element): void {
	for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
		const Event = type.startsWith("pointer") ? PointerEvent : MouseEvent;
		el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, button: 0, buttons: 1 }));
	}
}

/**
 * Enter and Tab move through Actual's own category list, which can land in a hidden
 * row. Editing then moves on, the same way, to the next row the filter shows.
 */
function skipHiddenRows(e: KeyboardEvent): void {
	if (!visible || (e.key !== "Enter" && e.key !== "Tab")) {
		return;
	}
	const table = (e.target as Element | null)?.closest?.('[data-testid="budget-table"]');
	const origin = (e.target as Element).closest('[data-testid="row"]');
	if (!table || !origin) {
		return;
	}
	// Waits for Actual to render the next editor, then moves it on if it landed in a hidden row.
	pendingEdit?.disconnect();
	pendingEdit = new MutationObserver(() => {
		const input = table.querySelector<HTMLInputElement>('[data-testid="budget"] input');
		if (!input || input === e.target) {
			return;
		}
		pendingEdit?.disconnect();
		pendingEdit = null;
		const landed = input.closest('[data-testid="row"]');
		if (landed && isHiddenRow(landed)) {
			moveEditor(table, origin, landed, input);
		}
	});
	pendingEdit.observe(table, { childList: true, subtree: true });
}

function moveEditor(table: Element, origin: Element, landed: Element, input: Element): void {
	const rows = [...table.querySelectorAll('[data-testid="row"]')].filter(rowCategory);
	const step = rows.indexOf(landed) >= rows.indexOf(origin) ? 1 : -1;
	const column = [...landed.querySelectorAll('[data-testid="budget"]')].indexOf(
		input.closest('[data-testid="budget"]')!,
	);
	let target = origin;
	for (let i = rows.indexOf(landed) + step; i >= 0 && i < rows.length; i += step) {
		if (!isHiddenRow(rows[i])) {
			target = rows[i];
			break;
		}
	}
	// Past the last shown row, pressing the row it came from closes the editor.
	const cell = target.querySelectorAll('[data-testid="budget"]')[column];
	if (cell) {
		press(cell.firstElementChild ?? cell);
	}
}

function reset(): void {
	runSeq++;
	pendingEdit?.disconnect();
	pendingEdit = null;
	visible = null;
	filterState.filter = "all";
	for (const el of document.querySelectorAll(`[${HIDDEN_ATTR}]`)) {
		el.removeAttribute(HIDDEN_ATTR);
	}
	tableShown = null;
	shownKey = "";
}

function sync(): void {
	// The budget page stays mounted, hidden, under the calendar; ABT's parts stay with it.
	if (isCalendarOpen()) {
		return;
	}
	if (!matchesPage(Page.Budget)) {
		unmountControl();
		if (tableShown) {
			reset();
		}
		return;
	}
	const table = document.querySelector<HTMLElement>('[data-testid="budget-table"]');
	if (!table) {
		return;
	}
	mountControl(table);
	tableShown = table;
	const key = shownSheets(table).join();
	if (key !== shownKey) {
		shownKey = key;
		void refresh(table, true);
	} else {
		applyRows(table);
	}
}

export const budgetCategoryFilter = defineSetting({
	type: "checkbox",
	label: "Category filter (experimental)",
	description:
		"Filter the budget table to categories that need attention (overspent or short of their target) or are funded.",
	icon: "filter",
	group: "Budget",
	context: {
		key: "budget-category-filter",
		defaultValue: false,
	},
	css: () => `
		[${HIDDEN_ATTR}] { display: none !important; }
		[${CONTROL_ATTR}] { display: contents; }
		/* Actual's category header row has no gap, so the control spaces itself from its icons. */
		[data-testid="budget-totals"] [${CONTROL_ATTR}] > * { margin-right: var(--abt-space-2); }
	`,
	init: () => {
		changes = collectChanges(REFRESH_MS, () => {
			if (tableShown) {
				void refresh(tableShown, false);
			}
		});
		const unwatch = watchDom(sync);
		const unwatchTable = watchElement('[data-testid="budget-table"]', sync);
		const unwatchCells = watchBudgetTable(onTableChange);
		const unwatchSlot = watchElement(HEADER_SLOT, sync);
		document.addEventListener("dragstart", blockDrag, true);
		document.addEventListener("keydown", skipHiddenRows, true);
		return () => {
			unwatch();
			unwatchTable();
			unwatchSlot();
			unwatchCells();
			changes?.stop();
			changes = null;
			document.removeEventListener("dragstart", blockDrag, true);
			document.removeEventListener("keydown", skipHiddenRows, true);
			unmountControl();
			reset();
		};
	},
});
