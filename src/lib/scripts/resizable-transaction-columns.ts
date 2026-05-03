import { applyGlobalCSS, createElement } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

type HeaderColumn = "date" | "account" | "payee" | "notes" | "category" | "payment" | "deposit";
type ResizableColumn = Exclude<HeaderColumn, "date">;
type StoredWidths = Partial<Record<HeaderColumn, number>>;

const RESIZE_HANDLE_CLASS = "abt-col-resizer";
const RESET_BUTTON_CLASS = "abt-col-reset-btn";
const ROOT_TOGGLE_ATTR = "data-abt-resizable-cols";
const HEADER_COLUMNS: HeaderColumn[] = ["date", "account", "payee", "notes", "category", "payment", "deposit"];
const RESIZABLE_COLUMNS: ResizableColumn[] = ["account", "payee", "notes", "category", "payment"];
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 620;
const FLEX_SHRINK_FLOOR = 80;
const MAX_WIDTH_BY_COLUMN: Record<ResizableColumn, number> = {
	account: 620,
	payee: 620,
	notes: 620,
	category: 620,
	payment: 190,
	deposit: 190,
};
const FLEX_DEFAULT_COLUMNS = new Set<HeaderColumn>(["account", "payee", "notes", "category"]);
const STATIC_FIXED_WIDTHS = {
	select: 20,
	cleared: 38,
} as const;
const DEFAULT_FIXED_WIDTHS: Record<Exclude<HeaderColumn, "account" | "payee" | "notes" | "category">, number> = {
	date: 110,
	payment: 100,
	deposit: 100,
};
const LEGACY_COLUMNS: Array<Exclude<HeaderColumn, "account">> = [
	"date",
	"payee",
	"notes",
	"category",
	"payment",
	"deposit",
];
const LEGACY_DEFAULT_WIDTHS: Record<Exclude<HeaderColumn, "account">, number> = {
	date: 110,
	payee: 240,
	notes: 200,
	category: 190,
	payment: 130,
	deposit: 130,
};

let observer: MutationObserver | null = null;
let scheduled = false;
let currentStorageKey = "";
let cachedWidths: StoredWidths = {};

function clampWidth(value: number): number {
	return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(value)));
}

function clampWidthLive(value: number): number {
	return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, value));
}

function getPageStorageKey(prefix: string): string {
	return `${prefix}:${window.location.pathname}`;
}

function cssVariableName(column: HeaderColumn): string {
	return `--abt-col-${column}`;
}

function isLegacySnapshot(widths: StoredWidths): boolean {
	for (const column of LEGACY_COLUMNS) {
		if (widths[column] !== LEGACY_DEFAULT_WIDTHS[column]) return false;
	}
	return true;
}

function normalizeSavedWidths(value: unknown): StoredWidths {
	if (!value || typeof value !== "object") return {};

	const result: StoredWidths = {};
	for (const column of HEADER_COLUMNS) {
		if (column === "date") continue;
		const raw = (value as Record<string, unknown>)[column];
		if (typeof raw === "number" && Number.isFinite(raw)) {
			result[column] = clampWidth(raw);
		}
	}

	if (isLegacySnapshot(result)) {
		return {};
	}

	return result;
}

function setFixedColumn(column: string, width: number, clamp = true): void {
	const root = document.documentElement;
	const normalizedWidth = clamp ? clampWidth(width) : Math.max(0, width);
	const px = `${normalizedWidth}px`;
	root.style.setProperty(cssVariableName(column as HeaderColumn), px);
	root.style.setProperty(`--abt-col-${column}-min`, px);
	root.style.setProperty(`--abt-col-${column}-max`, px);
	root.style.setProperty(`--abt-col-${column}-flex`, `0 0 ${px}`);
}

function setFlexColumn(column: HeaderColumn): void {
	const root = document.documentElement;
	root.style.setProperty(cssVariableName(column), "auto");
	root.style.setProperty(`--abt-col-${column}-min`, "0px");
	root.style.setProperty(`--abt-col-${column}-max`, "none");
	root.style.setProperty(`--abt-col-${column}-flex`, "1 1 0px");
}

function applyWidths(widths: StoredWidths): void {
	setFixedColumn("select", STATIC_FIXED_WIDTHS.select, false);
	setFixedColumn("cleared", STATIC_FIXED_WIDTHS.cleared, false);

	for (const column of HEADER_COLUMNS) {
		const savedWidth = widths[column];
		if (typeof savedWidth === "number") {
			setFixedColumn(column, savedWidth);
			continue;
		}

		if (FLEX_DEFAULT_COLUMNS.has(column)) {
			setFlexColumn(column);
			continue;
		}

		if (column in DEFAULT_FIXED_WIDTHS) {
			setFixedColumn(
				column as keyof typeof DEFAULT_FIXED_WIDTHS,
				DEFAULT_FIXED_WIDTHS[column as keyof typeof DEFAULT_FIXED_WIDTHS],
			);
		}
	}
}

function updateColumnWidth(column: HeaderColumn, width: number): void {
	cachedWidths[column] = clampWidthLive(width);
	setFixedColumn(column, cachedWidths[column] as number, false);
}

async function persistCurrentWidths(): Promise<void> {
	if (!currentStorageKey) return;
	await setValue(currentStorageKey, cachedWidths);
}

async function resetAllWidths(): Promise<void> {
	cachedWidths = {};
	applyWidths(cachedWidths);
	await persistCurrentWidths();
}

function removeHandles(): void {
	document.querySelectorAll(`.${RESIZE_HANDLE_CLASS}`).forEach((handle) => handle.remove());
	document.querySelectorAll(`.${RESET_BUTTON_CLASS}`).forEach((button) => button.remove());
}

function findHeaderRow(): HTMLElement | null {
	const rows = document.querySelectorAll<HTMLElement>("[data-testid='row']");
	for (const row of rows) {
		if (row.querySelector("[data-testid='payment']") && row.querySelector("[data-testid='deposit']")) {
			return row;
		}
	}
	return null;
}

function getCellWidth(row: HTMLElement, testId: string): number {
	const cell = row.querySelector<HTMLElement>(`[data-testid='${testId}']`);
	return cell ? cell.getBoundingClientRect().width : 0;
}

function getMaxResizableWidth(column: ResizableColumn): number {
	const headerRow = findHeaderRow();
	if (!headerRow) return MAX_WIDTH_BY_COLUMN[column] ?? MAX_COL_WIDTH;

	const containerWidth = headerRow.getBoundingClientRect().width;
	let reserved = getCellWidth(headerRow, "select") + getCellWidth(headerRow, "cleared");

	for (const other of HEADER_COLUMNS) {
		if (other === column) continue;

		const current = getCellWidth(headerRow, other);
		const isFlexDonor = FLEX_DEFAULT_COLUMNS.has(other) && typeof cachedWidths[other] !== "number";
		reserved += isFlexDonor ? Math.min(current, FLEX_SHRINK_FLOOR) : current;
	}

	return Math.max(
		MIN_COL_WIDTH,
		Math.min(MAX_WIDTH_BY_COLUMN[column] ?? MAX_COL_WIDTH, Math.floor(containerWidth - reserved)),
	);
}

function getMinWidth(column: ResizableColumn): number {
	return FLEX_DEFAULT_COLUMNS.has(column) ? FLEX_SHRINK_FLOOR : MIN_COL_WIDTH;
}

function getNextResizableColumn(column: ResizableColumn): ResizableColumn | null {
	const index = HEADER_COLUMNS.indexOf(column);
	for (let nextIndex = index + 1; nextIndex < HEADER_COLUMNS.length; nextIndex += 1) {
		const nextColumn = HEADER_COLUMNS[nextIndex];
		if (nextColumn === "date") continue;
		return nextColumn as ResizableColumn;
	}
	return null;
}

function addHandle(cell: HTMLElement, column: ResizableColumn): void {
	if (cell.querySelector(`.${RESIZE_HANDLE_CLASS}`)) return;
	if (!cell.style.position) {
		cell.style.position = "relative";
	}
	cell.style.paddingRight = "8px";

	const handle = createElement("div", {
		className: RESIZE_HANDLE_CLASS,
		title: `Resize ${column} column`,
	}) as HTMLDivElement;

	handle.addEventListener("pointerdown", (event: PointerEvent) => {
		event.preventDefault();
		event.stopPropagation();
		handle.setPointerCapture(event.pointerId);
		handle.dataset.dragging = "true";

		const startX = event.clientX;
		const startWidth = cell.getBoundingClientRect().width;
		let latestX = startX;
		let framePending = false;

		const nextColumn = getNextResizableColumn(column);
		const headerRow = findHeaderRow();
		const nextCell =
			nextColumn && headerRow ? headerRow.querySelector<HTMLElement>(`[data-testid='${nextColumn}']`) : null;
		const startNextWidth = nextCell?.getBoundingClientRect().width ?? 0;

		const applyDrag = () => {
			framePending = false;

			const deltaX = latestX - startX;

			if (nextColumn && nextCell) {
				const rawDelta = deltaX;
				const minDelta = Math.max(
					getMinWidth(column) - startWidth,
					startNextWidth - (MAX_WIDTH_BY_COLUMN[nextColumn] ?? MAX_COL_WIDTH),
				);
				const maxDelta = Math.min(
					(MAX_WIDTH_BY_COLUMN[column] ?? MAX_COL_WIDTH) - startWidth,
					startNextWidth - getMinWidth(nextColumn),
				);
				const delta = Math.max(minDelta, Math.min(maxDelta, rawDelta));

				updateColumnWidth(column, startWidth + delta);
				updateColumnWidth(nextColumn, startNextWidth - delta);
				return;
			}

			const proposedWidth = startWidth + deltaX;
			updateColumnWidth(column, Math.min(proposedWidth, getMaxResizableWidth(column)));
		};

		const onPointerMove = (moveEvent: PointerEvent) => {
			latestX = moveEvent.clientX;
			if (framePending) return;
			framePending = true;
			requestAnimationFrame(applyDrag);
		};

		const onPointerUp = (upEvent: PointerEvent) => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
			handle.dataset.dragging = "false";
			if (handle.hasPointerCapture(upEvent.pointerId)) {
				handle.releasePointerCapture(upEvent.pointerId);
			}
			persistCurrentWidths();
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
	});

	handle.addEventListener("dblclick", (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		delete cachedWidths[column];
		applyWidths(cachedWidths);
		void persistCurrentWidths();
	});

	cell.appendChild(handle);
}

function attachResetButton(headerRow: HTMLElement): void {
	if (headerRow.querySelector(`.${RESET_BUTTON_CLASS}`)) return;

	const button = createElement("button", {
		className: RESET_BUTTON_CLASS,
		textContent: "↺",
		title: "Reset all column widths",
	}) as HTMLButtonElement;

	button.type = "button";
	button.setAttribute("aria-label", "Reset all column widths");
	button.addEventListener("click", (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		void resetAllWidths();
	});

	headerRow.appendChild(button);
}

function attachHandles(): void {
	const headerRow = findHeaderRow();
	if (!headerRow) return;

	for (const column of RESIZABLE_COLUMNS) {
		const cell = headerRow.querySelector<HTMLElement>(`[data-testid='${column}']`);
		if (cell) addHandle(cell, column);
	}

	attachResetButton(headerRow);
}

function scheduleAttachHandles(): void {
	if (scheduled) return;
	scheduled = true;
	requestAnimationFrame(() => {
		scheduled = false;
		attachHandles();
	});
}

function startObserving(): void {
	if (observer) observer.disconnect();
	observer = new MutationObserver(() => {
		scheduleAttachHandles();
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
	scheduleAttachHandles();
}

function stopObserving(): void {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
}

export const resizableTransactionColumns = defineSetting({
	type: "checkbox",
	label: "Resizable Transaction Columns",
	context: {
		key: "resizable-transaction-columns",
		defaultValue: true,
		css: `
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="row"] {
				position: relative;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="select"] {
				width: var(--abt-col-select, 20px) !important;
				min-width: var(--abt-col-select-min, 20px) !important;
				max-width: var(--abt-col-select-max, 20px) !important;
				flex: var(--abt-col-select-flex, 0 0 20px) !important;
				position: sticky;
				left: 0;
				z-index: 8;
				background-clip: padding-box;
                padding-inline: 1rem;
                overflow: hidden;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="date"] {
				width: var(--abt-col-date, 110px) !important;
				min-width: var(--abt-col-date-min, 110px) !important;
				max-width: var(--abt-col-date-max, 110px) !important;
				flex: var(--abt-col-date-flex, 0 0 110px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="account"] {
				width: var(--abt-col-account, auto) !important;
				min-width: var(--abt-col-account-min, 80px) !important;
				max-width: var(--abt-col-account-max, none) !important;
				flex: var(--abt-col-account-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="payee"] {
				width: var(--abt-col-payee, auto) !important;
				min-width: var(--abt-col-payee-min, 80px) !important;
				max-width: var(--abt-col-payee-max, none) !important;
				flex: var(--abt-col-payee-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="notes"] {
				width: var(--abt-col-notes, auto) !important;
				min-width: var(--abt-col-notes-min, 80px) !important;
				max-width: var(--abt-col-notes-max, none) !important;
				flex: var(--abt-col-notes-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="category"] {
				width: var(--abt-col-category, auto) !important;
				min-width: var(--abt-col-category-min, 80px) !important;
				max-width: var(--abt-col-category-max, none) !important;
				flex: var(--abt-col-category-flex, 1 1 0px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="payment"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="debit"] {
				width: var(--abt-col-payment, 100px) !important;
				min-width: var(--abt-col-payment-min, 100px) !important;
				max-width: var(--abt-col-payment-max, 100px) !important;
				flex: var(--abt-col-payment-flex, 0 0 100px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="deposit"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="credit"] {
				width: var(--abt-col-deposit, 100px) !important;
				min-width: var(--abt-col-deposit-min, 100px) !important;
				max-width: var(--abt-col-deposit-max, 100px) !important;
				flex: var(--abt-col-deposit-flex, 0 0 100px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="cleared"] {
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
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="row"]:not(:has([data-testid="date"])) [data-testid="payee"] {
				margin-left: var(--abt-col-date, 110px) !important;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="transaction-table"] [data-testid="row"] > [data-testid] {
				overflow-y: hidden;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="transaction-table"] [data-testid="row"] {
				overflow-x: hidden;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="transaction-table"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="table"] {
				overflow-x: hidden !important;
				overflow-y: hidden !important;
				overscroll-behavior-x: none;
				overscroll-behavior-y: none;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="transaction-table"] [data-auto-sizer] > .animated {
				overflow-y: auto !important;
				overflow-x: hidden !important;
				overscroll-behavior-y: contain;
				overscroll-behavior-x: none;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESIZE_HANDLE_CLASS} {
				position: absolute;
				top: 2px;
				right: 2px;
				width: 1px;
				height: calc(100% - 4px);
				cursor: col-resize;
				z-index: 30;
				border-radius: 1px;
				background: color-mix(in srgb, var(--color-tableText) 24%, transparent);
				touch-action: none;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESIZE_HANDLE_CLASS}:hover {
				right: 0;
				width: 4px;
				background: color-mix(in srgb, var(--color-tableText) 34%, transparent);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESIZE_HANDLE_CLASS}[data-dragging="true"] {
				right: 0;
				width: 4px;
				transition: none;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESET_BUTTON_CLASS} {
				position: absolute;
				top: -40px;
				right: 385px;
				height: 22px;
				width: 22px;
				padding: 0;
				border: 0;
				border-radius: 0;
				background: transparent;
				color: var(--color-buttonNormalText);
				font-size: 14px;
				line-height: 1;
				cursor: pointer;
				z-index: 40;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${RESET_BUTTON_CLASS}:hover {
				color: var(--color-buttonNormalTextHover);
			}
		`,
	},
	init: async (ctx) => {
		stopObserving();
		removeHandles();
		applyGlobalCSS("", ctx.key);
		document.documentElement.removeAttribute(ROOT_TOGGLE_ATTR);

		const enabled = Boolean(await getValue(ctx.key, ctx.defaultValue));
		if (!enabled) return;

		currentStorageKey = getPageStorageKey(ctx.key);
		cachedWidths = normalizeSavedWidths(await getValue(currentStorageKey, {}));

		applyGlobalCSS(ctx.css, ctx.key);
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		applyWidths(cachedWidths);
		startObserving();
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (!value) {
			stopObserving();
			removeHandles();
			document.documentElement.removeAttribute(ROOT_TOGGLE_ATTR);
			applyGlobalCSS("", ctx.key);
			return;
		}

		currentStorageKey = getPageStorageKey(ctx.key);
		cachedWidths = normalizeSavedWidths(await getValue(currentStorageKey, {}));

		applyGlobalCSS(ctx.css, ctx.key);
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		applyWidths(cachedWidths);
		startObserving();
	},
});
