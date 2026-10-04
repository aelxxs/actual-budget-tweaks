import type { MonthMark } from "@lib/components/MonthPicker.svelte";
import { dispatch, send, setLocalPref } from "@lib/utilities/actual-api";
import { createLogger } from "@lib/utilities/logger";

const log = createLogger("month-header");

const SELECTED_CELL = '[data-testid="selected-budget-month"][data-month]';
const SETTLE_MS = 1000;

/** Actual's v2 calendar icon, used by its titlebar month-count selector. */
const CALENDAR_ICON = 'svg:has(> path[d^="M21.5 3h-2.75"])';

export const monthKey = (year: number, month: number) =>
	`${year}-${String(month + 1).padStart(2, "0")}`;

export function parseMonth(key: string): { year: number; month: number } {
	const [y, m] = key.split("-").map(Number);
	return { year: y, month: m - 1 };
}

export function addMonths(key: string, n: number): string {
	const { year, month } = parseMonth(key);
	const d = new Date(year, month + n, 1);
	return monthKey(d.getFullYear(), d.getMonth());
}

/** How far ahead the start month can go, matching Actual's own limit. */
export const MAX_FUTURE_MONTHS = 12;

export function latestStart(): string {
	return addMonths(currentMonth(), MAX_FUTURE_MONTHS);
}

export function currentMonth(): string {
	const now = new Date();
	return monthKey(now.getFullYear(), now.getMonth());
}

/** The months Actual is showing, from its (hidden) month picker's selected cells. */
export function readShownMonths(nativeHeader: Element): string[] {
	return [...nativeHeader.querySelectorAll<HTMLElement>(SELECTED_CELL)].map(
		(cell) => cell.dataset.month!,
	);
}

/**
 * Actual's titlebar month-count selector: one calendar icon per month that fits,
 * so the icon count is the most months the page can show. Absent when only one fits.
 */
export function findMonthCountSelector(): HTMLElement | null {
	let best: HTMLElement | null = null;
	let bestCount = 0;
	for (const svg of document.querySelectorAll(CALENDAR_ICON)) {
		// The month picker's own Today link uses the same icon.
		if (svg.closest("button, a")) continue;
		const parent = svg.parentElement;
		if (!parent) continue;
		const count = countMonthIcons(parent);
		if (count > bestCount) {
			best = parent;
			bestCount = count;
		}
	}
	return best;
}

export function countMonthIcons(selector: Element): number {
	return selector.querySelectorAll(`:scope > ${CALENDAR_ICON}`).length;
}

let fallbackHandler: (() => void) | null = null;

/** Called when the header can't move Actual's months at all, so the native controls come back. */
export function onNativeFallback(handler: () => void): () => void {
	fallbackHandler = handler;
	return () => {
		fallbackHandler = null;
	};
}

function giveUp(reason: string): void {
	log.error(`${reason} Showing Actual's own month controls instead.`);
	fallbackHandler?.();
}

const shownStart = () => document.querySelector<HTMLElement>(SELECTED_CELL)?.dataset.month ?? null;
const shownCount = () => document.querySelectorAll(SELECTED_CELL).length;

function waitFor(done: () => boolean): Promise<boolean> {
	const deadline = Date.now() + SETTLE_MS;
	return new Promise((resolve) => {
		const check = () => {
			if (done()) resolve(true);
			else if (Date.now() > deadline) resolve(false);
			else setTimeout(check, 50);
		};
		check();
	});
}

function monthsBetween(from: string, to: string): number {
	const a = parseMonth(from);
	const b = parseMonth(to);
	return (b.year - a.year) * 12 + (b.month - a.month);
}

/** Clicks Actual's hidden picker cell for `key`, or its farthest cell toward it when out of range. */
function clickNativeCell(key: string): boolean {
	const first = document.querySelector<HTMLElement>(SELECTED_CELL);
	const from = first?.dataset.month;
	if (!first?.parentElement || !from) return false;
	// Month cells are the row's divs; the Today/prev/next links are buttons.
	const cells = [...first.parentElement.children].filter(
		(el): el is HTMLElement => el instanceof HTMLDivElement,
	);
	const idx = cells.indexOf(first);
	const target = Math.max(0, Math.min(cells.length - 1, idx + monthsBetween(from, key)));
	if (target === idx) return false;
	cells[target].click();
	return true;
}

async function clickToward(key: string): Promise<boolean> {
	// The picker re-centres on each pick, so a far month takes a few hops.
	for (let hop = 0; hop < 12; hop++) {
		if (shownStart() === key) return true;
		const before = shownStart();
		if (!clickNativeCell(key) || !(await waitFor(() => shownStart() !== before))) return false;
	}
	return shownStart() === key;
}

/** Set the first time writing the pref has no visible effect; later moves go straight to clicks. */
let prefIgnored = false;

/**
 * Moves the budget to start at `key` by writing Actual's `budget.startMonth` local pref.
 * That relies on Actual's internals, so if it stops working this falls back to clicking
 * Actual's own picker, then to showing Actual's controls.
 */
export async function showMonth(key: string): Promise<void> {
	if (shownStart() === key) return;
	if (!prefIgnored) {
		try {
			await setLocalPref("budget.startMonth", key);
		} catch (e) {
			log.warn("Couldn't set budget.startMonth:", e);
		}
		if (await waitFor(() => shownStart() === key)) return;
		prefIgnored = true;
		log.warn("Setting budget.startMonth had no effect; clicking Actual's month picker instead.");
	}
	if (!(await clickToward(key))) giveUp("Couldn't change the budget month.");
}

export async function setMonthCount(count: number): Promise<void> {
	try {
		await dispatch("saveGlobalPrefs", { prefs: { maxMonths: count } });
	} catch (e) {
		log.warn("saveGlobalPrefs failed:", e);
	}
	if (!(await waitFor(() => shownCount() === count))) {
		giveUp("Couldn't change how many months are shown.");
	}
}

async function cell(sheetName: string, name: string): Promise<number | null> {
	try {
		const res = await send<{ value?: unknown }>("get-cell", { sheetName, name });
		return typeof res?.value === "number" ? res.value : null;
	} catch {
		return null;
	}
}

const sheetFor = (key: string) => `budget${key.replace("-", "")}`;

/** Picker dots: overspent or over-assigned months need attention. Read live, never stored. */
export async function loadMonthMarks(year: number): Promise<Partial<Record<number, MonthMark>>> {
	const bounds = await send<{ start: string; end: string } | null>("get-budget-bounds");
	const now = currentMonth();
	const entries = await Promise.all(
		Array.from({ length: 12 }, async (_, m): Promise<[number, MonthMark | null]> => {
			const key = monthKey(year, m);
			if (!bounds || key < bounds.start || key > bounds.end) return [m, "muted"];
			if (key > now) return [m, "future"];
			const next = addMonths(key, 1);
			const [toBudget, overspent] = await Promise.all([
				cell(sheetFor(key), "to-budget"),
				next <= bounds.end ? cell(sheetFor(next), "last-month-overspent") : null,
			]);
			// Tracking budgets have neither cell.
			if (toBudget == null && overspent == null) return [m, null];
			return [m, (toBudget ?? 0) < 0 || (overspent ?? 0) < 0 ? "warn" : "ok"];
		}),
	);
	const marks: Partial<Record<number, MonthMark>> = {};
	for (const [m, mark] of entries) if (mark) marks[m] = mark;
	return marks;
}
