import { defineSetting } from "@features/types";
import { createElement, createToolbarButton } from "@lib/dom/dom";
import { watchDom } from "@lib/dom/dom-watcher";
import { Page, matchesPage } from "@lib/actual/pages";
import { getValue, setValue } from "@lib/store";
import {
	ACCOUNT_CELL,
	AUTO_SIZER,
	BALANCE_CELL,
	CATEGORY_CELL,
	CLEARED_CELL,
	CREDIT_CELL,
	DATE_CELL,
	DEBIT_CELL,
	DEPOSIT_CELL,
	GROUP_CELL,
	NOTES_CELL,
	PAYEE_CELL,
	PAYMENT_CELL,
	ROW,
	SELECT_CELL,
	TABLE,
	TRANSACTION_HEADER,
	TRANSACTION_TABLE,
	byTestId,
} from "@lib/actual-dom";

type HeaderColumn =
	"date" | "account" | "payee" | "notes" | "group" | "category" | "payment" | "deposit" | "balance";
type ResizableColumn = Exclude<HeaderColumn, "date">;
type AmountColumn = "payment" | "deposit" | "balance";
type StoredWidths = Partial<Record<HeaderColumn, number>>;

const RESIZE_HANDLE_CLASS = "abt-col-resizer";
const RESET_BUTTON_ID = "abt-transaction-col-reset-btn";
const ROOT_TOGGLE_ATTR = "data-abt-resizable-cols";
const ROOT_RESIZING_ATTR = "data-abt-resizing-cols";
/** Amount columns the user has resized; the rest keep Actual's auto-measured width. */
const ROOT_FIXED_AMOUNTS_ATTR = "data-abt-fixed-amounts";
// Set per route rather than `:root:has([data-testid="budget-table"])`, which Firefox
// re-searched the whole page for on every row it styled, blanking fast scrolls.
const ROOT_BUDGET_ATTR = "data-abt-budget-page";
const HEADER_COLUMNS: HeaderColumn[] = [
	"date",
	"account",
	"payee",
	"notes",
	"group",
	"category",
	"payment",
	"deposit",
	"balance",
];
const RESIZABLE_COLUMNS = new Set<string>([
	"account",
	"payee",
	"notes",
	"group",
	"category",
	"payment",
	"deposit",
	"balance",
]);
const NON_FREE_COLUMNS = new Set<string>(["select", "cleared", "date"]);
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH_SAFETY = 9999;
const FLEX_SHRINK_FLOOR = 80;
// Only numeric columns have a semantic hard max. Text columns are bounded
// dynamically by available container space via getMaxResizableWidth.
const NUMERIC_MAX_WIDTH: Partial<Record<ResizableColumn, number>> = {
	payment: 190,
	deposit: 190,
	balance: 190,
};
const FLEX_DEFAULT_COLUMNS = new Set<HeaderColumn>([
	"account",
	"payee",
	"notes",
	"group",
	"category",
]);
const AMOUNT_COLUMNS = new Set<HeaderColumn>(["payment", "deposit", "balance"]);
const STATIC_FIXED_WIDTHS = {
	select: 20,
	cleared: 38,
} as const;
const DEFAULT_DATE_WIDTH = 110;

/** Each page keeps its own widths, stored under the setting's key plus the page's address. */
let storagePrefix = "";
let route = "";
let widths: StoredWidths = {};
let loadToken = 0;
const widthsCache = new Map<string, StoredWidths>();
/** The header the handles were last fitted to, and its columns then. */
let header: HTMLElement | null = null;
let headerColumns = "";

const routeKey = () => `${location.pathname}${location.search}${location.hash}`;
const storageKey = () => `${storagePrefix}:${route}`;

function clampWidth(value: number): number {
	return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH_SAFETY, Math.round(value)));
}

function clampWidthLive(value: number): number {
	return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH_SAFETY, value));
}

function sameWidths(a: StoredWidths, b: StoredWidths): boolean {
	return HEADER_COLUMNS.every((column) => a[column] === b[column]);
}

function normalizeSavedWidths(value: unknown): StoredWidths {
	if (!value || typeof value !== "object") {
		return {};
	}
	const result: StoredWidths = {};
	for (const column of HEADER_COLUMNS) {
		const raw = (value as Record<string, unknown>)[column];
		if (column !== "date" && typeof raw === "number" && Number.isFinite(raw)) {
			result[column] = clampWidth(raw);
		}
	}
	return result;
}

function setFixedColumn(column: string, width: number, clamp = true): void {
	const root = document.documentElement;
	const px = `${clamp ? clampWidth(width) : Math.max(0, width)}px`;
	root.style.setProperty(`--abt-col-${column}`, px);
	root.style.setProperty(`--abt-col-${column}-min`, px);
	root.style.setProperty(`--abt-col-${column}-max`, px);
	root.style.setProperty(`--abt-col-${column}-flex`, `0 0 ${px}`);
}

function setFlexColumn(column: HeaderColumn): void {
	const root = document.documentElement;
	root.style.setProperty(`--abt-col-${column}`, "auto");
	root.style.setProperty(`--abt-col-${column}-min`, "0px");
	root.style.setProperty(`--abt-col-${column}-max`, "none");
	root.style.setProperty(`--abt-col-${column}-flex`, "1 1 0px");
}

function syncFixedAmountsAttr(): void {
	const fixed = HEADER_COLUMNS.filter(
		(column) => AMOUNT_COLUMNS.has(column) && typeof widths[column] === "number",
	);
	document.documentElement.setAttribute(ROOT_FIXED_AMOUNTS_ATTR, fixed.join(" "));
}

function applyWidths(): void {
	setFixedColumn("select", STATIC_FIXED_WIDTHS.select, false);
	setFixedColumn("cleared", STATIC_FIXED_WIDTHS.cleared, false);
	for (const column of HEADER_COLUMNS) {
		const saved = widths[column];
		if (typeof saved === "number") {
			setFixedColumn(column, saved);
		} else if (FLEX_DEFAULT_COLUMNS.has(column)) {
			setFlexColumn(column);
		} else if (column === "date") {
			setFixedColumn(column, DEFAULT_DATE_WIDTH);
		}
	}
	syncFixedAmountsAttr();
}

function updateColumnWidth(column: HeaderColumn, width: number): void {
	widths[column] = clampWidthLive(width);
	setFixedColumn(column, widths[column], false);
	if (AMOUNT_COLUMNS.has(column)) {
		syncFixedAmountsAttr();
	}
}

async function persistWidths(): Promise<void> {
	if (!storagePrefix) {
		return;
	}
	const key = storageKey();
	widthsCache.set(key, { ...widths });
	await setValue(key, widths);
}

async function resetAllWidths(): Promise<void> {
	widths = {};
	applyWidths();
	await persistWidths();
}

/** The page's cached widths go on at once, before it paints; its stored ones follow. */
function enterRoute(next: string): Promise<void> {
	route = next;
	document.documentElement.toggleAttribute(ROOT_BUDGET_ATTR, matchesPage(Page.Budget));
	const key = storageKey();
	widths = { ...(widthsCache.get(key) ?? {}) };
	applyWidths();
	const token = ++loadToken;
	return getValue(key, {}).then((raw) => {
		if (token !== loadToken) {
			return;
		}
		const stored = normalizeSavedWidths(raw);
		widthsCache.set(key, stored);
		if (!sameWidths(widths, stored)) {
			widths = { ...stored };
			applyWidths();
		}
		if (header) {
			attachHandles(header);
		}
	});
}

function getColumnCell(row: HTMLElement, testId: string): HTMLElement | null {
	return row.querySelector<HTMLElement>(`:scope > ${byTestId(testId)}`);
}

function isVisibleCell(cell: HTMLElement | null): cell is HTMLElement {
	if (!cell) {
		return false;
	}
	const style = window.getComputedStyle(cell);
	if (style.display === "none" || style.visibility === "hidden") {
		return false;
	}
	return cell.getBoundingClientRect().width > 0;
}

function getVisibleColumnOrder(row: HTMLElement): string[] {
	return Array.from(row.querySelectorAll<HTMLElement>(":scope > [data-testid]"))
		.filter(isVisibleCell)
		.map((cell) => cell.dataset.testid ?? "")
		.filter(Boolean);
}

function getVisibleFreeColumns(row: HTMLElement): ResizableColumn[] {
	return getVisibleColumnOrder(row).filter(
		(col): col is ResizableColumn => !NON_FREE_COLUMNS.has(col),
	);
}

/** The last free column absorbs leftover space, so it never gets a handle or a fixed width. */
function getAnchorColumn(row: HTMLElement): ResizableColumn | undefined {
	return getVisibleFreeColumns(row).at(-1);
}

function getCellWidth(row: HTMLElement, testId: string): number {
	return getColumnCell(row, testId)?.getBoundingClientRect().width ?? 0;
}

/** Never below the current width: Actual may auto-widen amount columns past our cap. */
function getHardMaxWidth(column: ResizableColumn, currentWidth = 0): number {
	return Math.max(NUMERIC_MAX_WIDTH[column] ?? MAX_COL_WIDTH_SAFETY, currentWidth);
}

function getMaxResizableWidth(row: HTMLElement, column: ResizableColumn): number {
	let reserved = 0;
	for (const other of getVisibleColumnOrder(row)) {
		if (other === column) {
			continue;
		}
		const current = getCellWidth(row, other);
		const isFlexDonor =
			FLEX_DEFAULT_COLUMNS.has(other as HeaderColumn) &&
			typeof widths[other as HeaderColumn] !== "number";
		reserved += isFlexDonor ? Math.min(current, FLEX_SHRINK_FLOOR) : current;
	}
	return Math.max(
		MIN_COL_WIDTH,
		Math.min(
			getHardMaxWidth(column, getCellWidth(row, column)),
			Math.floor(row.getBoundingClientRect().width - reserved),
		),
	);
}

function getMinWidth(column: ResizableColumn): number {
	return FLEX_DEFAULT_COLUMNS.has(column) ? FLEX_SHRINK_FLOOR : MIN_COL_WIDTH;
}

function getNextResizableColumn(column: ResizableColumn, row: HTMLElement): ResizableColumn | null {
	const freeColumns = getVisibleFreeColumns(row);
	const index = freeColumns.indexOf(column);
	if (index === -1) {
		return null;
	}
	const next = freeColumns[index + 1] ?? null;
	// A flexible anchor absorbs the change itself; pairing would fix its width.
	if (next && next === freeColumns.at(-1) && FLEX_DEFAULT_COLUMNS.has(next)) {
		return null;
	}
	return next;
}

function addHandle(cell: HTMLElement, column: ResizableColumn): void {
	if (cell.querySelector(`.${RESIZE_HANDLE_CLASS}`)) {
		return;
	}

	const handle = createElement("div", {
		className: RESIZE_HANDLE_CLASS,
		title: `Resize ${column} column`,
	}) as HTMLDivElement;

	handle.addEventListener("pointerdown", (event: PointerEvent) => {
		event.preventDefault();
		event.stopPropagation();

		// Bail before entering drag state, or nothing would ever clear it.
		const row = header;
		if (!row || !isVisibleCell(getColumnCell(row, column))) {
			return;
		}

		document.documentElement.setAttribute(ROOT_RESIZING_ATTR, "on");
		handle.setPointerCapture(event.pointerId);
		handle.dataset.dragging = "true";

		const startX = event.clientX;
		const startWidth = cell.getBoundingClientRect().width;
		let latestX = startX;
		let framePending = false;

		const nextColumn = getNextResizableColumn(column, row);
		const nextCell = nextColumn ? getColumnCell(row, nextColumn) : null;
		const startNextWidth = nextCell?.getBoundingClientRect().width ?? 0;

		const applyDrag = () => {
			framePending = false;
			const deltaX = latestX - startX;

			if (nextColumn && nextCell) {
				const minDelta = Math.max(
					getMinWidth(column) - startWidth,
					startNextWidth - getHardMaxWidth(nextColumn, startNextWidth),
				);
				const maxDelta = Math.min(
					getHardMaxWidth(column, startWidth) - startWidth,
					startNextWidth - getMinWidth(nextColumn),
				);
				const delta = Math.max(minDelta, Math.min(maxDelta, deltaX));
				updateColumnWidth(column, startWidth + delta);
				updateColumnWidth(nextColumn, startNextWidth - delta);
				return;
			}

			updateColumnWidth(column, Math.min(startWidth + deltaX, getMaxResizableWidth(row, column)));
		};

		const onPointerMove = (moveEvent: PointerEvent) => {
			latestX = moveEvent.clientX;
			if (framePending) {
				return;
			}
			framePending = true;
			requestAnimationFrame(applyDrag);
		};

		const onPointerUp = (upEvent: PointerEvent) => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
			handle.dataset.dragging = "false";
			document.documentElement.removeAttribute(ROOT_RESIZING_ATTR);
			if (handle.hasPointerCapture(upEvent.pointerId)) {
				handle.releasePointerCapture(upEvent.pointerId);
			}
			void persistWidths();
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
	});

	handle.addEventListener("dblclick", (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		delete widths[column];
		applyWidths();
		void persistWidths();
	});

	cell.appendChild(handle);
}

function createSvgIcon(): SVGSVGElement {
	const ns = "http://www.w3.org/2000/svg";

	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("width", "16");
	svg.setAttribute("height", "16");
	svg.setAttribute("viewBox", "0 0 15 15");
	svg.setAttribute("fill", "none");
	svg.setAttribute("aria-hidden", "true");

	const path = document.createElementNS(ns, "path");
	path.setAttribute(
		"d",
		"M7.50009 1C7.77623 1 8.00009 1.22386 8.00009 1.5V13.5C8.00009 13.7761 7.77623 14 7.50009 14C7.22395 14 7.00009 13.7761 7.00009 13.5V1.5C7.00009 1.22386 7.22395 1 7.50009 1ZM11.6817 5.18164C11.8356 5.0278 12.0734 5.00851 12.2481 5.12402L12.3184 5.18164L14.3184 7.18164L14.3761 7.25195C14.4914 7.42662 14.4722 7.66458 14.3184 7.81836L12.3184 9.81836C12.1428 9.99403 11.8575 9.9939 11.6817 9.81836C11.506 9.64262 11.506 9.35738 11.6817 9.18164L12.9132 7.9502H9.50009C9.25174 7.95006 9.05 7.74836 9.04989 7.5C9.04989 7.25155 9.25167 7.04994 9.50009 7.0498H12.9132L11.6817 5.81836L11.6241 5.74805C11.5086 5.57335 11.5279 5.33548 11.6817 5.18164ZM2.75204 5.12402C2.92673 5.00854 3.16462 5.02781 3.31845 5.18164C3.47211 5.33549 3.49153 5.57343 3.37606 5.74805L3.31845 5.81836L2.087 7.0498H5.50009L5.59091 7.05957C5.79587 7.10161 5.95028 7.28261 5.95028 7.5C5.95019 7.71733 5.79584 7.89843 5.59091 7.94043L5.50009 7.9502H2.087L3.31845 9.18164L3.37606 9.25195C3.49141 9.42662 3.47222 9.66458 3.31845 9.81836C3.16467 9.97214 2.92671 9.99132 2.75204 9.87598L2.68173 9.81836L0.681729 7.81836C0.505993 7.64262 0.505993 7.35738 0.681729 7.18164L2.68173 5.18164L2.75204 5.12402Z",
	);
	path.setAttribute("fill", "currentColor");
	svg.appendChild(path);

	return svg;
}

function attachHandles(row: HTMLElement): void {
	const anchor = getAnchorColumn(row);
	// A saved width on a flexible anchor would leave nothing to fill the row, e.g. after a reorder.
	if (anchor && FLEX_DEFAULT_COLUMNS.has(anchor) && typeof widths[anchor] === "number") {
		delete widths[anchor];
		applyWidths();
		void persistWidths();
	}

	const resizable = new Set<string>(
		getVisibleFreeColumns(row).filter((col) => col !== anchor && RESIZABLE_COLUMNS.has(col)),
	);
	row.querySelectorAll<HTMLElement>(`.${RESIZE_HANDLE_CLASS}`).forEach((handle) => {
		const testId = handle.parentElement?.dataset.testid;
		if (testId && !resizable.has(testId)) {
			handle.remove();
		}
	});
	for (const column of resizable) {
		const cell = getColumnCell(row, column);
		if (cell) {
			addHandle(cell, column as ResizableColumn);
		}
	}
}

// Runs on every DOM batch, so everything but the route check waits for a header that changed.
function onDom(): void {
	const next = routeKey();
	if (next !== route) {
		void enterRoute(next);
	}
	const found = document.querySelector<HTMLElement>(TRANSACTION_HEADER);
	if (!found) {
		header = null;
		headerColumns = "";
		return;
	}
	if (!document.getElementById(RESET_BUTTON_ID)) {
		createToolbarButton({
			id: RESET_BUTTON_ID,
			title: "Reset all column widths",
			icon: createSvgIcon(),
			onClick: () => void resetAllWidths(),
		});
	}
	const columns = Array.from(found.children, (c) => (c as HTMLElement).dataset.testid).join(" ");
	if (found === header && columns === headerColumns) {
		return;
	}
	header = found;
	headerColumns = columns;
	attachHandles(found);
}

function amountColumnCss(column: AmountColumn, testIds: string[], rootSuffix = ""): string {
	const root = `:root[${ROOT_TOGGLE_ATTR}="on"][${ROOT_FIXED_AMOUNTS_ATTR}~="${column}"]${rootSuffix}`;
	return `
		${testIds.map((id) => `${root} ${byTestId(id)}`).join(",\n\t\t")} {
			width: var(--abt-col-${column}) !important;
			min-width: var(--abt-col-${column}-min) !important;
			max-width: var(--abt-col-${column}-max) !important;
			flex: var(--abt-col-${column}-flex) !important;
		}`;
}

export const resizableTransactionColumns = defineSetting({
	type: "checkbox",
	label: "Resizable columns",
	description: "Drag a column's edge in the transaction table to resize it.",
	group: "Transactions",
	icon: "columns3",
	context: {
		key: "resizable-transaction-columns",
		defaultValue: true,
	},
	css: () => `
			:root[${ROOT_TOGGLE_ATTR}="on"]:not([${ROOT_BUDGET_ATTR}]) ${ROW} {
				position: relative;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${ACCOUNT_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${PAYEE_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${NOTES_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${GROUP_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${CATEGORY_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${PAYMENT_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${DEBIT_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${DEPOSIT_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${CREDIT_CELL},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${BALANCE_CELL} {
				position: relative;
				padding-right: var(--abt-space-3);
			}
			/* Group isn't sortable, so Actual renders bare text without the 5px button padding the other headers get. */
			:root[${ROOT_TOGGLE_ATTR}="on"] ${TRANSACTION_HEADER} ${GROUP_CELL} span {
				padding: 0 5px;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${SELECT_CELL} {
				width: var(--abt-col-select, 20px) !important;
				min-width: var(--abt-col-select-min, 20px) !important;
				max-width: var(--abt-col-select-max, 20px) !important;
				flex: var(--abt-col-select-flex, 0 0 20px) !important;
				position: sticky;
				left: 0;
				z-index: 8;
				background-clip: padding-box;
                overflow: hidden;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${DATE_CELL} {
				width: var(--abt-col-date, 110px) !important;
				min-width: var(--abt-col-date-min, 110px) !important;
				max-width: var(--abt-col-date-max, 110px) !important;
				flex: var(--abt-col-date-flex, 0 0 110px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${ACCOUNT_CELL} {
				width: var(--abt-col-account, auto) !important;
				min-width: var(--abt-col-account-min, 80px) !important;
				max-width: var(--abt-col-account-max, none) !important;
				flex: var(--abt-col-account-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${PAYEE_CELL} {
				width: var(--abt-col-payee, auto) !important;
				min-width: var(--abt-col-payee-min, 80px) !important;
				max-width: var(--abt-col-payee-max, none) !important;
				flex: var(--abt-col-payee-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${NOTES_CELL} {
				width: var(--abt-col-notes, auto) !important;
				min-width: var(--abt-col-notes-min, 80px) !important;
				max-width: var(--abt-col-notes-max, none) !important;
				flex: var(--abt-col-notes-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${GROUP_CELL} {
				width: var(--abt-col-group, auto) !important;
				min-width: var(--abt-col-group-min, 80px) !important;
				max-width: var(--abt-col-group-max, none) !important;
				flex: var(--abt-col-group-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${CATEGORY_CELL} {
				width: var(--abt-col-category, auto) !important;
				min-width: var(--abt-col-category-min, 80px) !important;
				max-width: var(--abt-col-category-max, none) !important;
				flex: var(--abt-col-category-flex, 1 1 0px) !important;
			}
			/* Amount columns stay on Actual's auto-measured width until resized. */
			${amountColumnCss("payment", ["payment", "debit"])}
			${amountColumnCss("deposit", ["deposit", "credit"])}
			${amountColumnCss("balance", ["balance"], `:not([${ROOT_BUDGET_ATTR}])`)}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${CLEARED_CELL} {
				width: var(--abt-col-cleared, 38px) !important;
				min-width: var(--abt-col-cleared-min, 38px) !important;
				max-width: var(--abt-col-cleared-max, 38px) !important;
				flex: var(--abt-col-cleared-flex, 0 0 38px) !important;
				flex-shrink: 0 !important;
				position: sticky;
				right: 0;
				z-index: 9;
				background-clip: padding-box;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${TRANSACTION_TABLE} ${ROW} {
				overflow-x: hidden;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${TRANSACTION_TABLE},
			:root[${ROOT_TOGGLE_ATTR}="on"] ${TABLE} {
				overflow-x: hidden !important;
				overflow-y: hidden !important;
				overscroll-behavior-x: none;
				overscroll-behavior-y: none;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] ${TRANSACTION_TABLE} ${AUTO_SIZER} > .animated {
				overflow-y: auto !important;
				overflow-x: hidden !important;
				overscroll-behavior-y: contain;
				overscroll-behavior-x: none;
			}
			/* Transparent grab area; the visible line is ::before so it can stay short. */
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESIZE_HANDLE_CLASS} {
				position: absolute;
				top: 0;
				right: 0;
				width: 7px;
				height: 100%;
				cursor: col-resize;
				z-index: 30;
				touch-action: none;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESIZE_HANDLE_CLASS}::before {
				content: "";
				position: absolute;
				top: 50%;
				right: 2px;
				width: 1px;
				height: 45%;
				border-radius: var(--abt-radius-pill);
				transform: translateY(-50%);
				background: color-mix(in srgb, var(--color-tableText) 22%, transparent);
				transition:
					height 0.12s ease,
					width 0.12s ease,
					background 0.12s ease;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESIZE_HANDLE_CLASS}:hover::before {
				width: 3px;
				height: 70%;
				background: color-mix(in srgb, var(--abt-accent) 70%, transparent); /* raw: hover sits between accent-4 and the solid drag line */
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESIZE_HANDLE_CLASS}[data-dragging="true"]::before {
				width: 3px;
				height: 100%;
				background: var(--abt-accent);
				box-shadow: 0 0 0 3px var(--abt-accent-3);
				transition: none;
			}
		`,
	init: async (ctx) => {
		const root = document.documentElement;
		storagePrefix = ctx.key;
		route = "";
		header = null;
		headerColumns = "";
		root.setAttribute(ROOT_TOGGLE_ATTR, "on");
		await enterRoute(routeKey());
		const stop = watchDom(onDom);

		return () => {
			stop();
			loadToken++;
			document.querySelectorAll(`.${RESIZE_HANDLE_CLASS}`).forEach((handle) => handle.remove());
			document.getElementById(RESET_BUTTON_ID)?.remove();
			root.removeAttribute(ROOT_TOGGLE_ATTR);
			root.removeAttribute(ROOT_RESIZING_ATTR);
			root.removeAttribute(ROOT_FIXED_AMOUNTS_ATTR);
			root.removeAttribute(ROOT_BUDGET_ATTR);
			storagePrefix = "";
			header = null;
		};
	},
});
