import { fetchCells, markCellsStale } from "@features/readability/category-progress/cells";
import { defineSetting } from "@features/types";
import { BALANCE_CELL, BUDGET_TABLE, CATEGORY_NAME, ROW } from "@lib/actual-dom";
import { loadCategories } from "@lib/template-plan/actual-data";
import { onListChange } from "@lib/utilities/actual-api";
import { collectChanges, shownSheets, watchBudgetTable } from "@lib/utilities/budget-cells";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";

const ATTR = "data-abt-group-over";
const REFRESH_MS = 250;

/** Overspent categories per group name, in any shown month. */
let overByGroup = new Map<string, number>();
let changes: ReturnType<typeof collectChanges> | null = null;
let runSeq = 0;

/** `fresh` reloads the categories: the shared list can be another budget's after switching. */
async function count(fresh = false): Promise<void> {
	const table = document.querySelector<HTMLElement>(BUDGET_TABLE);
	if (!table) {
		return;
	}
	const seq = ++runSeq;
	const sheets = shownSheets(table);
	const cats = (await loadCategories(fresh)).filter((c) => !c.hidden);
	const over = new Map<string, number>();
	await Promise.all(
		cats.map(async (c) => {
			const months = await Promise.all(sheets.map((s) => fetchCells(s, c.id)));
			if (months.some((m) => m.balance < 0)) {
				over.set(c.group_name, (over.get(c.group_name) ?? 0) + 1);
			}
		}),
	);
	if (seq !== runSeq) {
		return;
	}
	overByGroup = over;
	mark();
}

/** The group's name, as the first text in its row; Actual doesn't allow two groups one name. */
function nameElement(row: Element): HTMLElement | null {
	const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
	});
	return walker.nextNode()?.parentElement ?? null;
}

function mark(): void {
	const table = document.querySelector(BUDGET_TABLE);
	if (!table) {
		return;
	}
	for (const row of table.querySelectorAll(ROW)) {
		if (row.querySelector(CATEGORY_NAME) || !row.querySelector(BALANCE_CELL)) {
			continue;
		}
		const name = nameElement(row);
		if (!name) {
			continue;
		}
		const n = overByGroup.get(name.textContent?.trim() ?? "");
		const value = n ? `${n} over` : null;
		if (name.getAttribute(ATTR) !== value) {
			if (value) {
				name.setAttribute(ATTR, value);
			} else {
				name.removeAttribute(ATTR);
			}
		}
	}
}

// Rows re-render as groups collapse and the table scrolls.
function sync(): void {
	if (matchesPage(Page.Budget)) {
		mark();
	}
}

export const groupOverspent = defineSetting({
	type: "checkbox",
	label: "Flag overspent groups",
	description: "Shows how many categories are overspent beside each group's name.",
	group: "Budget",
	icon: "alert",
	context: {
		key: "group-overspent",
		defaultValue: false,
	},
	css: () => `
		[${ATTR}]::after {
			content: attr(${ATTR});
			margin-left: var(--abt-space-3);
			padding: 1px var(--abt-space-2);
			border-radius: var(--abt-radius-pill);
			background: color-mix(in srgb, var(--color-errorText) 15%, transparent);
			color: var(--color-errorText);
			font-size: var(--abt-text-xs);
			font-weight: 600;
			white-space: nowrap;
		}
	`,
	init: () => {
		changes = collectChanges(REFRESH_MS, () => count());
		const unwatch = watchDom(sync);
		const unwatchCells = watchBudgetTable(({ moved, changed, changedCells }) => {
			markCellsStale(changedCells);
			if (moved) {
				void count(true);
			} else if (changed.size) {
				changes?.add(changed);
			}
		});
		const unwatchList = onListChange("categories", () => void count(true));
		return () => {
			unwatch();
			unwatchCells();
			unwatchList();
			changes?.stop();
			changes = null;
			runSeq++;
			overByGroup = new Map();
			for (const el of document.querySelectorAll(`[${ATTR}]`)) {
				el.removeAttribute(ATTR);
			}
		};
	},
});
