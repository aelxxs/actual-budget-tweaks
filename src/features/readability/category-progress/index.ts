import { defineSetting } from "@features/types";
import CategoryProgressPreview from "../previews/CategoryProgress.svelte";
import { goalFunding } from "@features/workflows/goal-funding";
import { icon } from "@lib/icons";
import { readCell } from "@lib/utilities/budget-cells";
import { loadCurrency } from "@lib/utilities/currency";
import { addMonths, monthToSheet, sheetToMonth } from "@lib/utilities/months";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { positionPopover } from "@lib/utilities/popover";
import { getValue } from "@lib/utilities/store";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import {
	BALANCE_CELL_RE,
	BALANCE_WATCH_OPTIONS,
	clearCellCache,
	fetchCells,
	type CatCells,
} from "./cells";
import ProgressPopover from "./ProgressPopover.svelte";

const RING_CLASS = "abt-catprog-ring";
const POPOVER_CLASS = "abt-catprog-popover";
const HOVER_DELAY_MS = 150;
const CLOSE_DELAY_MS = 150;
const AVG_MONTHS = 3;

const CSS = `
	.${RING_CLASS} {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		margin-left: 4px;
		cursor: help;
		opacity: 0.85;
		transition: opacity 0.15s;
	}

	.${RING_CLASS}:hover {
		opacity: 1;
	}

	.${RING_CLASS} svg {
		width: 12px;
		height: 12px;
	}

	.${RING_CLASS} .track {
		fill: none;
		stroke: color-mix(in srgb, currentColor 22%, transparent);
		stroke-width: 2.5;
	}

	.${RING_CLASS} .fill {
		fill: none;
		stroke: var(--color-noticeTextLight);
		stroke-width: 2.5;
		stroke-linecap: round;
		transition: stroke-dasharray 140ms ease;
	}

	.${RING_CLASS}[data-state="near"] .fill { stroke: var(--color-warningText); }
	.${RING_CLASS}[data-state="over"] .fill { stroke: var(--color-warningText); }
	.${RING_CLASS}[data-state="overspent"] .fill { stroke: var(--color-errorText); }
	.${RING_CLASS}[data-state="empty"] .fill { stroke: transparent; }

	.${POPOVER_CLASS} {
		position: fixed;
		z-index: 10000;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		border-radius: var(--abt-radius);
		box-shadow: 0 8px 24px rgba(0,0,0,0.35);
		font-family: inherit;
	}
`;

export const categoryProgress = defineSetting({
	type: "checkbox",
	label: "Category Progress Indicators",
	description: "A progress ring next to each budget balance — hover for spending details.",
	group: "Budget",
	icon: "gauge",
	preview: CategoryProgressPreview,
	context: {
		key: "category-progress-indicators",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		loadCurrency();
		const unwatch = watchDom(scanAndDecorate, document.body, BALANCE_WATCH_OPTIONS);
		return () => {
			unwatch();
			undecorateAll();
			closePopover(true);
			clearCellCache();
		};
	},
});

async function fetchAvgSpent(sheet: string, catId: string): Promise<number | null> {
	const values = await Promise.all(
		Array.from({ length: AVG_MONTHS }, (_, i) =>
			readCell(prevSheet(sheet, i + 1), `sum-amount-${catId}`, 0),
		),
	);
	const spends = values.map((v) => Math.max(0, -v));
	if (spends.every((s) => s === 0)) {
		return null;
	}
	return Math.round(spends.reduce((a, b) => a + b, 0) / spends.length);
}

// ── Sheet/month helpers ─────────────────────────────────────────

function prevSheet(sheet: string, monthsBack: number): string {
	const month = sheetToMonth(sheet);
	return month ? monthToSheet(addMonths(month, -monthsBack)) : sheet;
}

function sheetMonthLabel(sheet: string): string {
	const m = sheet.match(/^budget(\d{4})(\d{2})$/);
	if (!m) {
		return "";
	}
	return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
		new Date(Number(m[1]), Number(m[2]) - 1, 1),
	);
}

function daysLeftInMonth(sheet: string): number | null {
	const m = sheet.match(/^budget(\d{4})(\d{2})$/);
	if (!m) {
		return null;
	}
	const now = new Date();
	if (now.getFullYear() !== Number(m[1]) || now.getMonth() + 1 !== Number(m[2])) {
		return null;
	}
	const daysInMonth = new Date(Number(m[1]), Number(m[2]), 0).getDate();
	return daysInMonth - now.getDate() + 1;
}

// ── Ring injection ──────────────────────────────────────────────

function paintRing(ring: HTMLElement, data: CatCells) {
	const ratio = data.budgeted > 0 ? data.spent / data.budgeted : data.spent > 0 ? Infinity : 0;
	const isCurrentMonth = daysLeftInMonth(ring.dataset.sheet || "") != null;

	let state: string;
	if (data.balance < 0) {
		state = "overspent";
	} else if (ratio > 1) {
		state = "over";
	} else if (data.budgeted > 0 && data.spent === data.budgeted) {
		// Exactly fully spent is the envelope working as planned (fixed bills
		// like rent land here every month) — completion, not a warning.
		state = "full";
	} else if (isCurrentMonth && ratio >= 0.85) {
		// "Running low" is only actionable while the month is still going.
		state = "near";
	} else if (data.budgeted <= 0 && data.spent <= 0) {
		state = "empty";
	} else {
		state = "under";
	}
	ring.dataset.state = state;

	const percent =
		state === "empty" ? 0 : Math.min(100, Math.max(2, (Number.isFinite(ratio) ? ratio : 1) * 100));
	const fill = ring.querySelector<SVGCircleElement>(".fill");

	if (fill) {
		fill.setAttribute("stroke-dasharray", `${percent} 100`);
	}
}

function scanAndDecorate() {
	if (!matchesPage(Page.Budget)) {
		undecorateAll();
		closePopover(true);
		return;
	}

	for (const span of document.querySelectorAll<HTMLElement>(
		'[data-testid="balance"] span[data-cellname]',
	)) {
		const m = (span.getAttribute("data-cellname") || "").match(BALANCE_CELL_RE);
		if (!m) {
			continue;
		}
		const [, sheet, catId] = m;

		const host = span.closest("button") || span.closest<HTMLElement>('[data-testid="balance"]');
		if (!host) {
			continue;
		}

		let ring = host.querySelector<HTMLElement>(`:scope > .${RING_CLASS}`);
		if (!ring) {
			ring = document.createElement("span");
			ring.className = RING_CLASS;
			ring.dataset.state = "empty";
			ring.innerHTML = icon("progressRing", { size: 12 });
			ring.addEventListener("mouseenter", onRingEnter);
			ring.addEventListener("mouseleave", onRingLeave);
			host.appendChild(ring);
		}

		// React reuses these nodes when navigating months — rebind if the cell
		// now shows a different sheet, and force-refresh when the rendered
		// balance text changed (covers budget edits, where cached cell values
		// would otherwise stay stale for the full cache TTL).
		ring.dataset.sheet = sheet;
		ring.dataset.catId = catId;
		const txt = span.textContent || "";
		const force = ring.dataset.txt !== undefined && ring.dataset.txt !== txt;
		ring.dataset.txt = txt;

		fetchCells(sheet, catId, force).then((data) => {
			if (ring.isConnected && ring.dataset.sheet === sheet && ring.dataset.catId === catId) {
				paintRing(ring, data);
			}
		});
	}
}

function undecorateAll() {
	for (const ring of document.querySelectorAll<HTMLElement>(`.${RING_CLASS}`)) {
		ring.removeEventListener("mouseenter", onRingEnter);
		ring.removeEventListener("mouseleave", onRingLeave);
		ring.remove();
	}
}

// ── Popover ─────────────────────────────────────────────────────

let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let popover: Mounted | null = null;
let popoverRing: HTMLElement | null = null;

function onRingEnter(e: Event) {
	const ring = e.currentTarget as HTMLElement;
	if (closeTimer) {
		clearTimeout(closeTimer);
	}
	if (popoverRing === ring) {
		return;
	}
	if (hoverTimer) {
		clearTimeout(hoverTimer);
	}
	hoverTimer = setTimeout(() => openPopover(ring), HOVER_DELAY_MS);
}

function onRingLeave() {
	if (hoverTimer) {
		clearTimeout(hoverTimer);
	}
	scheduleClose();
}

function scheduleClose() {
	if (closeTimer) {
		clearTimeout(closeTimer);
	}
	closeTimer = setTimeout(() => closePopover(), CLOSE_DELAY_MS);
}

async function openPopover(ring: HTMLElement) {
	const sheet = ring.dataset.sheet;
	const catId = ring.dataset.catId;
	if (!sheet || !catId) {
		return;
	}

	const row = ring.closest<HTMLElement>('[data-testid="row"]');
	const name =
		row?.querySelector('[data-testid="category-name"]')?.textContent?.trim() || "Category";

	const [data, avgSpent, canFund] = await Promise.all([
		fetchCells(sheet, catId, true),
		fetchAvgSpent(sheet, catId),
		getValue(goalFunding.context.key, goalFunding.context.defaultValue),
	]);
	if (!ring.isConnected) {
		return;
	}
	paintRing(ring, data);

	closePopover(true);

	popover = mountToNodeWithReturn(ProgressPopover, {
		name,
		month: sheetMonthLabel(sheet),
		budgeted: data.budgeted,
		spent: data.spent,
		balance: data.balance,
		goalShortfall: data.goalShortfall,
		canFund: Boolean(canFund),
		avgSpent,
		daysLeft: daysLeftInMonth(sheet),
	});
	const wrap = popover.node;
	wrap.className = POPOVER_CLASS;
	wrap.style.display = "block";
	wrap.addEventListener("mouseenter", () => {
		if (closeTimer) {
			clearTimeout(closeTimer);
		}
	});
	wrap.addEventListener("mouseleave", scheduleClose);
	document.body.appendChild(wrap);
	popoverRing = ring;

	positionPopover(wrap, ring, { gap: 6, align: "right" });
}

function closePopover(immediate?: boolean) {
	if (immediate && closeTimer) {
		clearTimeout(closeTimer);
	}
	popover?.destroy();
	popover = null;
	popoverRing = null;
}
