import { defineSetting } from "@features/types";
import { loadCurrency } from "@lib/utilities/currency";
import { watchDom } from "@lib/utilities/dom-watcher";
import { positionPopover } from "@lib/utilities/popover";
import { mountToNode } from "@lib/utilities/svelte";
import { getInsights, getProgressCents, invalidateCache, loadData, resetData } from "./data";
import InsightsPopover from "./InsightsPopover.svelte";
import type { CategoryInsight } from "./types";

const BAR_CLASS = "abt-cti-bar";
const BAR_ATTR = "data-abt-cti-row";
const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
const ROW_SELECTOR = '[data-testid="row"]:has([data-testid="category-name"])';
const HOVER_DELAY_MS = 200;

const CSS = `
	.${BAR_CLASS} {
		position: absolute;
		left: 0;
		bottom: 0;
		height: 3px;
		width: 0;
		background: var(--color-noticeTextLight);
		transition: width 140ms ease, opacity 0.15s;
		pointer-events: none;
		z-index: 1;
		opacity: 0.65;
	}

	[draggable="true"]:hover > .${BAR_CLASS} {
		opacity: 0.9;
	}

	.${BAR_CLASS}[data-state="under"] { background: var(--color-formInputBorderSelected); }
	.${BAR_CLASS}[data-state="near"] { background: var(--color-warningText); }
	.${BAR_CLASS}[data-state="full"] { opacity: 0.65; }
	.${BAR_CLASS}[data-state="paid"] { opacity: 0.65; }

	.abt-cti-popover-wrap {
		position: fixed;
		z-index: 10000;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		border-radius: 6px;
		box-shadow: 0 8px 24px rgba(0,0,0,0.35);
		font-family: inherit;
	}
`;

export const categoryTemplateInsights = defineSetting({
	type: "checkbox",
	label: "Category Template Insights",
	context: {
		key: "actual-category-template-insights",
		defaultValue: true,
	},
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(scanAndDecorate);
		startPolling();
		loadCurrency();
		loadData().then(() => scanAndDecorate());

		return () => {
			unwatch();
			stopPolling();
			undecorateAll();
			closePopover();
			resetData();
		};
	},
});

// ── Row scanning ────────────────────────────────────────────────

function getCategoryIdForRow(row: HTMLElement): string | null {
	const idSrc = row.querySelector('[data-testid*="sum-amount-"], [data-testid*="leftover-"]');
	if (!idSrc) return null;
	const m = (idSrc.getAttribute("data-testid") || "").match(UUID_RE);
	return m ? m[1] : null;
}

function getNameColumn(row: HTMLElement): HTMLElement | null {
	return row.querySelector('[draggable="true"]');
}

function scanAndDecorate() {
	const data = getInsights();
	if (!data) return;
	for (const row of document.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
		const id = getCategoryIdForRow(row);
		if (!id) continue;
		const entry = data.get(id);
		if (!entry) continue;
		decorateRow(row, entry);
	}
}

function decorateRow(row: HTMLElement, entry: CategoryInsight) {
	if (row.getAttribute(BAR_ATTR) === entry.id) {
		updateRowBar(row, entry);
		return;
	}
	row.setAttribute(BAR_ATTR, entry.id);

	const col = getNameColumn(row);
	if (!col) return;
	if (!col.style.position) col.style.position = "relative";

	let bar = col.querySelector<HTMLElement>(`:scope > .${BAR_CLASS}`);
	if (!bar) {
		bar = document.createElement("div");
		bar.className = BAR_CLASS;
		col.appendChild(bar);
	}
	updateRowBar(row, entry);

	const nameCell = row.querySelector<HTMLElement>('[data-testid="category-name"]');
	if (nameCell) nameCell.style.cursor = "help";

	(col as any).__abtCtiRow = row;
	col.addEventListener("mouseenter", onColMouseEnter);
	col.addEventListener("mouseleave", onColMouseLeave);
}

function undecorateRow(row: HTMLElement) {
	row.removeAttribute(BAR_ATTR);
	const col = getNameColumn(row);
	if (col) {
		const bar = col.querySelector<HTMLElement>(`:scope > .${BAR_CLASS}`);
		if (bar) bar.remove();
		col.removeEventListener("mouseenter", onColMouseEnter);
		col.removeEventListener("mouseleave", onColMouseLeave);
		delete (col as any).__abtCtiRow;
	}
	const nameCell = row.querySelector<HTMLElement>('[data-testid="category-name"]');

	if (nameCell) nameCell.style.removeProperty("cursor");
}

function undecorateAll() {
	for (const row of document.querySelectorAll<HTMLElement>(`[${BAR_ATTR}]`)) {
		undecorateRow(row);
	}
}

async function updateRowBar(row: HTMLElement, entry: CategoryInsight) {
	const col = getNameColumn(row);
	if (!col) return;
	const bar = col.querySelector<HTMLElement>(`:scope > .${BAR_CLASS}`);
	if (!bar) return;
	const { numerator, denominator } = await getProgressCents(row, entry);
	if (numerator == null || !denominator || denominator <= 0) {
		bar.style.width = "0%";
		bar.dataset.state = "unknown";
		return;
	}
	const ratio = Math.max(0, numerator / denominator);
	const pct = Math.min(100, ratio * 100);
	bar.style.width = pct > 0 ? Math.max(1.5, pct) + "%" : "0%";
	const allPaid = entry.linkedSchedules.length > 0 && entry.linkedSchedules.every((ls) => ls.paid);
	if (allPaid) bar.dataset.state = "paid";
	else if (ratio >= 1) bar.dataset.state = "full";
	else if (ratio >= 0.8) bar.dataset.state = "near";
	else bar.dataset.state = "under";
}

// ── Popover ─────────────────────────────────────────────────────

let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let currentRow: HTMLElement | null = null;
let currentCol: HTMLElement | null = null;
let popoverWrap: HTMLElement | null = null;

function onColMouseEnter(e: Event) {
	const col = e.currentTarget as HTMLElement;
	const row = (col as any).__abtCtiRow as HTMLElement;
	if (!row) return;
	currentRow = row;
	currentCol = col;
	if (hoverTimer) clearTimeout(hoverTimer);
	hoverTimer = setTimeout(() => {
		if (currentRow === row) openPopover(row, col);
	}, HOVER_DELAY_MS);
}

function onColMouseLeave(e: Event) {
	const col = e.currentTarget as HTMLElement;
	if (hoverTimer) clearTimeout(hoverTimer);
	if (currentCol === col) {
		currentCol = null;
		currentRow = null;
	}
	closePopover();
}

async function openPopover(row: HTMLElement, anchor: HTMLElement) {
	const data = getInsights();
	if (!data) return;
	const id = getCategoryIdForRow(row);
	if (!id) return;
	const entry = data.get(id);
	if (!entry) return;

	closePopover();

	const progress = await getProgressCents(row, entry);
	if (currentRow !== row) return;

	const wrap = mountToNode(InsightsPopover, {
		entry,
		progress,
		onClose: closePopover,
	});
	wrap.className = "abt-cti-popover-wrap";
	wrap.style.display = "block";
	document.body.appendChild(wrap);
	popoverWrap = wrap;

	positionPopover(wrap, anchor, { gap: 6 });
}

function closePopover() {
	if (popoverWrap) {
		popoverWrap.remove();
		popoverWrap = null;
	}
}

// ── Polling ───────────────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastUrl = location.href;
let lastSheet: string | null = null;

function startPolling() {
	if (pollInterval) return;
	pollInterval = setInterval(() => {
		const sheet = document.querySelector('[data-testid^="budget2"][data-testid*="!sum-amount-"]');
		const sheetName = sheet?.getAttribute("data-testid")?.match(/^(budget\d{6})!/)?.[1] ?? null;
		if (location.href !== lastUrl || (sheetName && sheetName !== lastSheet)) {
			lastUrl = location.href;
			lastSheet = sheetName;
			invalidateCache();
		}
		scanAndDecorate();
	}, 1500);
}

function stopPolling() {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}
