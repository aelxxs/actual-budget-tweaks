import { defineSetting } from "@features/types";
import { icon } from "@lib/icons";
import { send } from "@lib/utilities/actual-api";
import { loadCurrency } from "@lib/utilities/currency";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { positionPopover } from "@lib/utilities/popover";
import { mountToNode } from "@lib/utilities/svelte";
import ProgressPopover from "./ProgressPopover.svelte";

const RING_CLASS = "abt-catprog-ring";
const POPOVER_CLASS = "abt-catprog-popover";
const CELL_RE = /^(budget\d{6})!leftover-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const CACHE_MS = 15000;
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
		border-radius: 6px;
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
	context: {
		key: "category-progress-indicators",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		loadCurrency();
		const unwatch = watchDom(scanAndDecorate);
		return () => {
			unwatch();
			undecorateAll();
			closePopover(true);
			cellCache.clear();
		};
	},
});

// ── Cell data ───────────────────────────────────────────────────

interface CatCells {
	budgeted: number;
	spent: number; // positive cents
	balance: number;
	goal: number;
	fetchedAt: number;
}

const cellCache = new Map<string, CatCells>();
const inflight = new Map<string, Promise<CatCells>>();

async function cellValue(sheet: string, name: string): Promise<number> {
	try {
		const res = await send("get-cell", { sheetName: sheet, name });
		return res && typeof res.value === "number" ? res.value : 0;
	} catch {
		return 0;
	}
}

function fetchCells(sheet: string, catId: string, force?: boolean): Promise<CatCells> {
	const key = `${sheet}:${catId}`;
	const cached = cellCache.get(key);
	if (!force && cached && Date.now() - cached.fetchedAt < CACHE_MS) return Promise.resolve(cached);
	const pending = inflight.get(key);
	if (!force && pending) return pending;

	const promise = (async () => {
		const [budgeted, sumAmount, balance, goal] = await Promise.all([
			cellValue(sheet, `budget-${catId}`),
			cellValue(sheet, `sum-amount-${catId}`),
			cellValue(sheet, `leftover-${catId}`),
			cellValue(sheet, `goal-${catId}`),
		]);
		const data: CatCells = {
			budgeted,
			spent: Math.max(0, -sumAmount),
			balance,
			goal,
			fetchedAt: Date.now(),
		};
		cellCache.set(key, data);
		inflight.delete(key);
		return data;
	})();
	inflight.set(key, promise);
	return promise;
}

async function fetchAvgSpent(sheet: string, catId: string): Promise<number | null> {
	const values = await Promise.all(
		Array.from({ length: AVG_MONTHS }, (_, i) => cellValue(prevSheet(sheet, i + 1), `sum-amount-${catId}`)),
	);
	const spends = values.map((v) => Math.max(0, -v));
	if (spends.every((s) => s === 0)) return null;
	return Math.round(spends.reduce((a, b) => a + b, 0) / spends.length);
}

// ── Sheet/month helpers ─────────────────────────────────────────

function prevSheet(sheet: string, monthsBack: number): string {
	const m = sheet.match(/^budget(\d{4})(\d{2})$/);
	if (!m) return sheet;
	const d = new Date(Number(m[1]), Number(m[2]) - 1 - monthsBack, 1);
	return `budget${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sheetMonthLabel(sheet: string): string {
	const m = sheet.match(/^budget(\d{4})(\d{2})$/);
	if (!m) return "";
	return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
		new Date(Number(m[1]), Number(m[2]) - 1, 1),
	);
}

function daysLeftInMonth(sheet: string): number | null {
	const m = sheet.match(/^budget(\d{4})(\d{2})$/);
	if (!m) return null;
	const now = new Date();
	if (now.getFullYear() !== Number(m[1]) || now.getMonth() + 1 !== Number(m[2])) return null;
	const daysInMonth = new Date(Number(m[1]), Number(m[2]), 0).getDate();
	return daysInMonth - now.getDate() + 1;
}

// ── Ring injection ──────────────────────────────────────────────

function paintRing(ring: HTMLElement, data: CatCells) {
	const ratio = data.budgeted > 0 ? data.spent / data.budgeted : data.spent > 0 ? Infinity : 0;

	let state: string;
	if (data.balance < 0) {
		state = "overspent";
	} else if (ratio > 1) {
		state = "over";
	} else if (ratio >= 0.85) {
		state = "near";
	} else if (data.budgeted <= 0 && data.spent <= 0) {
		state = "empty";
	} else {
		state = "under";
	}
	ring.dataset.state = state;

	const percent = state === "empty" ? 0 : Math.min(100, Math.max(2, (Number.isFinite(ratio) ? ratio : 1) * 100));
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

	for (const span of document.querySelectorAll<HTMLElement>('[data-testid="balance"] span[data-cellname]')) {
		const m = (span.getAttribute("data-cellname") || "").match(CELL_RE);
		if (!m) continue;
		const [, sheet, catId] = m;

		const host = span.closest("button") || span.closest<HTMLElement>('[data-testid="balance"]');
		if (!host) continue;

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
let popoverWrap: HTMLElement | null = null;
let popoverRing: HTMLElement | null = null;

function onRingEnter(e: Event) {
	const ring = e.currentTarget as HTMLElement;
	if (closeTimer) clearTimeout(closeTimer);
	if (popoverRing === ring) return;
	if (hoverTimer) clearTimeout(hoverTimer);
	hoverTimer = setTimeout(() => openPopover(ring), HOVER_DELAY_MS);
}

function onRingLeave() {
	if (hoverTimer) clearTimeout(hoverTimer);
	scheduleClose();
}

function scheduleClose() {
	if (closeTimer) clearTimeout(closeTimer);
	closeTimer = setTimeout(() => closePopover(), CLOSE_DELAY_MS);
}

async function openPopover(ring: HTMLElement) {
	const sheet = ring.dataset.sheet;
	const catId = ring.dataset.catId;
	if (!sheet || !catId) return;

	const row = ring.closest<HTMLElement>('[data-testid="row"]');
	const name = row?.querySelector('[data-testid="category-name"]')?.textContent?.trim() || "Category";

	const [data, avgSpent] = await Promise.all([fetchCells(sheet, catId, true), fetchAvgSpent(sheet, catId)]);
	if (!ring.isConnected) return;
	paintRing(ring, data);

	closePopover(true);

	const wrap = mountToNode(ProgressPopover, {
		name,
		month: sheetMonthLabel(sheet),
		budgeted: data.budgeted,
		spent: data.spent,
		balance: data.balance,
		goal: data.goal,
		avgSpent,
		daysLeft: daysLeftInMonth(sheet),
	});
	wrap.className = POPOVER_CLASS;
	wrap.style.display = "block";
	wrap.addEventListener("mouseenter", () => {
		if (closeTimer) clearTimeout(closeTimer);
	});
	wrap.addEventListener("mouseleave", scheduleClose);
	document.body.appendChild(wrap);
	popoverWrap = wrap;
	popoverRing = ring;

	positionPopover(wrap, ring, { gap: 6, align: "right" });
}

function closePopover(immediate?: boolean) {
	if (immediate && closeTimer) clearTimeout(closeTimer);
	if (popoverWrap) {
		popoverWrap.remove();
		popoverWrap = null;
	}
	popoverRing = null;
}
