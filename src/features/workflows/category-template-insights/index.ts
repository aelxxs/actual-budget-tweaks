import { defineSetting } from "@features/types";
import {
	type BudgetTableChange,
	collectChanges,
	watchBudgetTable,
} from "@lib/utilities/budget-cells";
import { rowCategoryId } from "@lib/utilities/budget-cells";
import { loadCurrency } from "@lib/utilities/currency";
import { getCurrentSheet } from "@lib/utilities/template-plan/actual-data";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { positionPopover } from "@lib/utilities/popover";
import { getValue, removeValue, setValue } from "@lib/utilities/store";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import {
	type MonthValues,
	getInsights,
	loadData,
	loadMonthValues,
	progressFor,
	progressState,
	resetData,
} from "./data";
import InsightsPopover from "./InsightsPopover.svelte";
import type { CategoryInsight } from "./types";

const BAR_CLASS = "abt-cti-bar";
const BAR_ATTR = "data-abt-cti-row";
export const STATE_ATTR = "data-abt-cti-state";
// The bars used to have their own hide flag; it is folded into this setting once (see init).
const LEGACY_BARS_KEY = "abt-cti-bars-enabled";
const ROW_SELECTOR = '[data-testid="row"]:has([data-testid="category-name"])';
const HOVER_DELAY_MS = 200;
// Long enough to fold one edit's burst of cell updates into a single re-read.
const REFRESH_MS = 100;

const CSS = `
	/* Along the row's bottom edge, filled to --p; thin and dim so it doesn't outweigh the row. */
	.${BAR_CLASS} {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2.5px;
		pointer-events: none;
		z-index: 1;
	}

	.${BAR_CLASS}::after {
		content: "";
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--p, 0%);
		background: var(--abt-accent);
		opacity: 0.5;
		transition: width 0.3s ease, opacity 0.15s;
	}

	[draggable="true"]:hover > .${BAR_CLASS}::after {
		opacity: 0.85;
	}

	.${BAR_CLASS}[data-state="near"]::after { background: var(--color-warningText); }
	.${BAR_CLASS}:is([data-state="full"], [data-state="paid"])::after {
		background: var(--color-noticeTextLight);
		opacity: 0.3;
	}
	.${BAR_CLASS}[data-state="unknown"] { display: none; }

	.abt-cti-popover-wrap {
		position: fixed;
		z-index: 10000;
	}
`;

export const categoryTemplateInsights = defineSetting({
	type: "checkbox",
	label: "Category Template Insights",
	description: "Progress bars showing how funded each category's template is.",
	icon: "interest",
	context: {
		key: "actual-category-template-insights",
		defaultValue: true,
	},
	css: () => CSS,
	init: async (ctx) => {
		const legacyBarsEnabled = await getValue<boolean | null>(LEGACY_BARS_KEY, null);
		if (legacyBarsEnabled !== null) {
			await removeValue(LEGACY_BARS_KEY);
			if (!legacyBarsEnabled) {
				await setValue(ctx.key, false);
				return;
			}
		}

		loadCurrency();
		const unwatch = watchDom(scanAndDecorate);
		scanAndDecorate();

		return () => {
			unwatch();
			stopLive();
			undecorateAll();
			closePopover();
			wasOnBudgetPage = false;
			resetData();
		};
	},
});

// ── Page gating ─────────────────────────────────────────────────

let wasOnBudgetPage = false;

// ── Row scanning ────────────────────────────────────────────────

function getNameColumn(row: HTMLElement): HTMLElement | null {
	return row.querySelector('[draggable="true"]');
}

function scanAndDecorate() {
	if (!matchesPage(Page.Budget)) {
		if (wasOnBudgetPage) {
			wasOnBudgetPage = false;
			stopLive();
			undecorateAll();
			closePopover();
		}
		return;
	}
	wasOnBudgetPage = true;
	watchTable();
	// First visit or another month: the table watcher can miss a switch, so ask here too.
	const sheet = getCurrentSheet();
	if (sheet && sheet !== requestedSheet) {
		requestedSheet = sheet;
		refreshNow();
	}

	const data = getInsights();
	if (!data) {
		return;
	}
	for (const row of document.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
		const id = rowCategoryId(row);
		if (!id) {
			continue;
		}
		const entry = data.get(id);
		if (entry) {
			decorateRow(row, entry);
		}
		// Its template was removed, or Actual reused the row for another category.
		else if (row.hasAttribute(BAR_ATTR)) {
			undecorateRow(row);
		}
	}
}

function decorateRow(row: HTMLElement, entry: CategoryInsight) {
	if (row.getAttribute(BAR_ATTR) === entry.id) {
		updateRowBar(row, entry);
		return;
	}
	row.setAttribute(BAR_ATTR, entry.id);

	const col = getNameColumn(row);
	if (!col) {
		return;
	}
	if (!col.style.position) {
		col.style.position = "relative";
	}

	let bar = col.querySelector<HTMLElement>(`:scope > .${BAR_CLASS}`);
	if (!bar) {
		bar = document.createElement("div");
		bar.className = BAR_CLASS;
		col.appendChild(bar);
	}
	updateRowBar(row, entry);

	const nameCell = row.querySelector<HTMLElement>('[data-testid="category-name"]');
	if (nameCell) {
		nameCell.style.cursor = "help";
	}

	(col as any).__abtCtiRow = row;
	col.addEventListener("mouseenter", onColMouseEnter);
	col.addEventListener("mouseleave", onColMouseLeave);
}

function undecorateRow(row: HTMLElement) {
	row.removeAttribute(BAR_ATTR);
	row.removeAttribute(STATE_ATTR);
	const col = getNameColumn(row);
	if (col) {
		const bar = col.querySelector<HTMLElement>(`:scope > .${BAR_CLASS}`);
		if (bar) {
			bar.remove();
		}
		col.removeEventListener("mouseenter", onColMouseEnter);
		col.removeEventListener("mouseleave", onColMouseLeave);
		delete (col as any).__abtCtiRow;
	}
	const nameCell = row.querySelector<HTMLElement>('[data-testid="category-name"]');

	if (nameCell) {
		nameCell.style.removeProperty("cursor");
	}
}

function undecorateAll() {
	for (const row of document.querySelectorAll<HTMLElement>(`[${BAR_ATTR}]`)) {
		undecorateRow(row);
	}
}

function updateRowBar(row: HTMLElement, entry: CategoryInsight) {
	const col = getNameColumn(row);
	if (!col) {
		return;
	}
	const bar = col.querySelector<HTMLElement>(`:scope > .${BAR_CLASS}`);
	if (!bar) {
		return;
	}
	// Until the shown month's values arrive, bars keep their last width to grow or shrink from.
	if (monthValues?.sheet !== getCurrentSheet()) {
		return;
	}
	const { numerator, denominator } = progressFor(row, entry, monthValues);
	if (numerator == null || !denominator || denominator <= 0) {
		bar.dataset.state = "unknown";
		row.setAttribute(STATE_ATTR, "unknown");
		return;
	}
	const ratio = Math.max(0, numerator / denominator);
	const pct = Math.min(100, ratio * 100);
	// A new bar (Actual rebuilds rows on a month switch) needs its empty start computed first, or
	// it appears at full width without growing in.
	if (!bar.dataset.state) {
		void getComputedStyle(bar, "::after").width;
	}
	bar.style.setProperty("--p", pct > 0 ? Math.max(1.5, pct) + "%" : "0%");
	bar.dataset.state = progressState(entry, ratio);
	row.setAttribute(STATE_ATTR, bar.dataset.state);
}

// ── Live values ─────────────────────────────────────────────────
// Re-read whenever the shown month's cells change (budgeting, applying templates, a synced
// transaction) or the month does, like the Insights panel; nothing is cached between reads.

let monthValues: MonthValues | null = null;
let requestedSheet: string | null = null;
let refreshSeq = 0;
let stopTable: (() => void) | null = null;
let changes: ReturnType<typeof collectChanges> | null = null;

// A month switch is read at once, so the last month's bars don't linger; edits wait to batch.
function refreshNow() {
	changes?.cancel();
	refresh({ reload: false });
}

async function refresh({ reload = true }: { reload?: boolean } = {}) {
	const sheet = getCurrentSheet();
	if (!sheet) {
		return;
	}
	const seq = ++refreshSeq;
	// After an edit, templates and schedules may have changed too (notes, a payment landing).
	if (reload) {
		resetData();
	}
	const data = await loadData();
	if (!data || seq !== refreshSeq) {
		return;
	}
	const values = await loadMonthValues(sheet, data.keys());
	// A newer read (another month, or a later edit) started while this one waited.
	if (seq !== refreshSeq) {
		return;
	}
	monthValues = values;
	scanAndDecorate();
}

function onTableChange({ changed }: BudgetTableChange) {
	const sheet = getCurrentSheet();
	if (!sheet) {
		return;
	}
	if (sheet !== requestedSheet) {
		requestedSheet = sheet;
		refreshNow();
	} else if (changed.has(sheet)) {
		changes?.add(changed);
	}
}

function watchTable() {
	changes ??= collectChanges(REFRESH_MS, () => void refresh());
	stopTable ??= watchBudgetTable(onTableChange);
}

function stopLive() {
	stopTable?.();
	stopTable = null;
	changes?.stop();
	changes = null;
	refreshSeq++;
	monthValues = null;
	requestedSheet = null;
}

// ── Popover ─────────────────────────────────────────────────────

let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let currentRow: HTMLElement | null = null;
let currentCol: HTMLElement | null = null;
let popover: Mounted | null = null;

function onColMouseEnter(e: Event) {
	const col = e.currentTarget as HTMLElement;
	const row = (col as any).__abtCtiRow as HTMLElement;
	if (!row) {
		return;
	}
	currentRow = row;
	currentCol = col;
	if (hoverTimer) {
		clearTimeout(hoverTimer);
	}
	hoverTimer = setTimeout(() => {
		if (currentRow === row) {
			openPopover(row, col);
		}
	}, HOVER_DELAY_MS);
}

function onColMouseLeave(e: Event) {
	const col = e.currentTarget as HTMLElement;
	if (hoverTimer) {
		clearTimeout(hoverTimer);
	}
	if (currentCol === col) {
		currentCol = null;
		currentRow = null;
	}
	closePopover();
}

function openPopover(row: HTMLElement, anchor: HTMLElement) {
	const data = getInsights();
	if (!data) {
		return;
	}
	const id = rowCategoryId(row);
	if (!id) {
		return;
	}
	const entry = data.get(id);
	if (!entry) {
		return;
	}

	// Opening a schedule navigates away while a hover over the row underneath may still be pending.
	if (currentRow !== row || !row.isConnected || !matchesPage(Page.Budget)) {
		return;
	}
	closePopover();
	const progress = progressFor(row, entry, monthValues);

	popover = mountToNodeWithReturn(InsightsPopover, {
		entry,
		progress,
		onClose: dismissPopover,
	});
	popover.node.className = "abt-popover abt-cti-popover-wrap";
	popover.node.style.display = "block";
	document.body.appendChild(popover.node);
	positionPopover(popover.node, anchor, { gap: 6 });
}

// Closes it for good, dropping any hover still waiting to open one.
function dismissPopover() {
	if (hoverTimer) {
		clearTimeout(hoverTimer);
	}
	hoverTimer = null;
	currentRow = null;
	currentCol = null;
	closePopover();
}

function closePopover() {
	popover?.destroy();
	popover = null;
}
