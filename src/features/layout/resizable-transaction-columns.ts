import { defineSetting } from "@features/types";
import { applyGlobalCSS, createElement, createToolbarButton } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

type HeaderColumn = "date" | "account" | "payee" | "notes" | "category" | "payment" | "deposit" | "balance";
type ResizableColumn = Exclude<HeaderColumn, "date">;
type StoredWidths = Partial<Record<HeaderColumn, number>>;

const RESIZE_HANDLE_CLASS = "abt-col-resizer";
const RESET_BUTTON_CLASS = "abt-col-reset-btn";
const ROOT_TOGGLE_ATTR = "data-abt-resizable-cols";
const ROOT_RESIZING_ATTR = "data-abt-resizing-cols";
const ROUTE_REFRESH_DELAY_MS = 0;
const INITIAL_ATTACH_RETRY_FRAMES = 6;
const HEADER_COLUMNS: HeaderColumn[] = [
	"date",
	"account",
	"payee",
	"notes",
	"category",
	"payment",
	"deposit",
	"balance",
];
const RESIZABLE_COLUMNS: ResizableColumn[] = ["account", "payee", "notes", "category", "payment"];
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
const FLEX_DEFAULT_COLUMNS = new Set<HeaderColumn>(["account", "payee", "notes", "category"]);
const STATIC_FIXED_WIDTHS = {
	select: 20,
	cleared: 38,
} as const;
const DEFAULT_FIXED_WIDTHS: Record<Exclude<HeaderColumn, "account" | "payee" | "notes" | "category">, number> = {
	date: 110,
	payment: 100,
	deposit: 100,
	balance: 100,
};
const LEGACY_COLUMNS: Array<Exclude<HeaderColumn, "account">> = [
	"date",
	"payee",
	"notes",
	"category",
	"payment",
	"deposit",
	"balance",
];
const LEGACY_DEFAULT_WIDTHS: Record<Exclude<HeaderColumn, "account">, number> = {
	date: 110,
	payee: 240,
	notes: 200,
	category: 190,
	payment: 130,
	deposit: 130,
	balance: 130,
};

let headerObserver: MutationObserver | null = null;
let scheduled = false;
let currentStorageKey = "";
let cachedWidths: StoredWidths = {};
let storagePrefixKey = "";
let routeSyncToken = 0;
const pageWidthsCache = new Map<string, StoredWidths>();
let routeRefreshTimer: number | null = null;
let observedRouteKey = "";
let observedHeaderRow: HTMLElement | null = null;
let observedHeaderCellCount = 0;
let initialAttachObserver: MutationObserver | null = null;
let routePollInterval: number | null = null;
let routeListenersInstalled = false;
let originalPushState: History["pushState"] | null = null;
let originalReplaceState: History["replaceState"] | null = null;

function onRouteSignal(): void {
	const currentRouteKey = getCurrentRouteKey();
	if (currentRouteKey === observedRouteKey) return;
	observedRouteKey = currentRouteKey;

	// Apply widths synchronously before React re-renders the new page so the new
	// header never paints with the previous page's CSS variable values.
	if (storagePrefixKey) {
		const nextKey = getPageStorageKey(storagePrefixKey);
		if (nextKey !== currentStorageKey) {
			const cached = pageWidthsCache.get(nextKey);
			cachedWidths = cached ? { ...cached } : {};
			applyWidths(cachedWidths);
		}
	}

	scheduleRouteRefresh();
}

function areWidthsEqual(a: StoredWidths, b: StoredWidths): boolean {
	for (const column of HEADER_COLUMNS) {
		if (column === "date") continue;
		if (a[column] !== b[column]) return false;
	}
	return true;
}

function clampWidth(value: number): number {
	return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH_SAFETY, Math.round(value)));
}

function clampWidthLive(value: number): number {
	return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH_SAFETY, value));
}

function getCurrentRouteKey(): string {
	return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getPageStorageKey(prefix: string): string {
	return `${prefix}:${getCurrentRouteKey()}`;
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
	pageWidthsCache.set(currentStorageKey, { ...cachedWidths });
	await setValue(currentStorageKey, cachedWidths);
}

async function resetAllWidths(): Promise<void> {
	cachedWidths = {};
	applyWidths(cachedWidths);
	await persistCurrentWidths();
}

async function syncPageWidths(force = false): Promise<void> {
	if (!storagePrefixKey) return;

	const nextStorageKey = getPageStorageKey(storagePrefixKey);
	const previousStorageKey = currentStorageKey;
	if (!force && nextStorageKey === currentStorageKey) {
		return;
	}

	currentStorageKey = nextStorageKey;

	const cachedPageWidths = pageWidthsCache.get(nextStorageKey);
	const fastWidths = cachedPageWidths ? { ...cachedPageWidths } : {};
	if (force || !areWidthsEqual(cachedWidths, fastWidths)) {
		cachedWidths = fastWidths;
		applyWidths(cachedWidths);
	}

	const syncToken = ++routeSyncToken;
	const storedWidths = normalizeSavedWidths(await getValue(nextStorageKey, {}));
	if (syncToken !== routeSyncToken || currentStorageKey !== nextStorageKey) return;

	const changed = !areWidthsEqual(cachedWidths, storedWidths);
	cachedWidths = storedWidths;
	pageWidthsCache.set(nextStorageKey, { ...storedWidths });
	if (changed || force || previousStorageKey !== nextStorageKey) {
		applyWidths(cachedWidths);
	}
	scheduleAttachHandles();
}

function scheduleRouteRefresh(): void {
	if (routeRefreshTimer !== null) {
		window.clearTimeout(routeRefreshTimer);
	}

	routeRefreshTimer = window.setTimeout(() => {
		routeRefreshTimer = null;
		void syncPageWidths();
	}, ROUTE_REFRESH_DELAY_MS);
}

function observeHeaderRow(headerRow: HTMLElement | null): void {
	if (!headerRow) {
		if (headerObserver) {
			headerObserver.disconnect();
			headerObserver = null;
		}
		observedHeaderRow = null;
		observedHeaderCellCount = 0;
		return;
	}

	if (initialAttachObserver) {
		initialAttachObserver.disconnect();
		initialAttachObserver = null;
	}

	const headerCells = Array.from(headerRow.querySelectorAll<HTMLElement>(":scope > [data-testid]"));
	const cellCountChanged = headerCells.length !== observedHeaderCellCount;

	if (observedHeaderRow === headerRow && headerObserver && !cellCountChanged) {
		return;
	}

	if (headerObserver) {
		headerObserver.disconnect();
	}

	observedHeaderRow = headerRow;
	observedHeaderCellCount = headerCells.length;
	headerObserver = new MutationObserver((records) => {
		let headerStructureChanged = false;
		for (const record of records) {
			if (record.type === "childList" && record.target === observedHeaderRow) {
				headerStructureChanged = true;
				break;
			}
		}

		scheduleAttachHandles();
		if (headerStructureChanged) {
			requestAnimationFrame(() => {
				observeHeaderRow(findHeaderRow());
			});
		}
	});

	headerObserver.observe(headerRow, {
		childList: true,
		subtree: false,
	});

	for (const cell of headerCells) {
		headerObserver.observe(cell, {
			attributes: true,
			attributeFilter: ["style", "class", "hidden"],
		});
	}
}

function installRouteListeners(): void {
	if (routeListenersInstalled) return;
	routeListenersInstalled = true;

	originalPushState = window.history.pushState.bind(window.history);
	originalReplaceState = window.history.replaceState.bind(window.history);

	window.history.pushState = function (...args: Parameters<History["pushState"]>) {
		const result = originalPushState?.(...args);
		onRouteSignal();
		return result;
	};

	window.history.replaceState = function (...args: Parameters<History["replaceState"]>) {
		const result = originalReplaceState?.(...args);
		onRouteSignal();
		return result;
	};

	window.addEventListener("popstate", onRouteSignal);
	window.addEventListener("hashchange", onRouteSignal);
	if (routePollInterval === null) {
		routePollInterval = window.setInterval(onRouteSignal, 250);
	}
}

function uninstallRouteListeners(): void {
	if (!routeListenersInstalled) return;
	routeListenersInstalled = false;

	if (originalPushState) {
		window.history.pushState = originalPushState;
		originalPushState = null;
	}

	if (originalReplaceState) {
		window.history.replaceState = originalReplaceState;
		originalReplaceState = null;
	}

	window.removeEventListener("popstate", onRouteSignal);
	window.removeEventListener("hashchange", onRouteSignal);
	if (routePollInterval !== null) {
		window.clearInterval(routePollInterval);
		routePollInterval = null;
	}
}

function removeHandles(): void {
	document.querySelectorAll(`.${RESIZE_HANDLE_CLASS}`).forEach((handle) => handle.remove());
	document.querySelectorAll(`.${RESET_BUTTON_CLASS}`).forEach((button) => button.remove());
}

function getColumnCell(row: HTMLElement, testId: string): HTMLElement | null {
	return row.querySelector<HTMLElement>(`[data-testid='${testId}']`);
}

function isVisibleCell(cell: HTMLElement | null): cell is HTMLElement {
	if (!cell) return false;
	const style = window.getComputedStyle(cell);
	if (style.display === "none" || style.visibility === "hidden") return false;
	return cell.getBoundingClientRect().width > 0;
}

function isVisibleColumn(row: HTMLElement, testId: string): boolean {
	return isVisibleCell(getColumnCell(row, testId));
}

function getVisibleColumnOrder(row: HTMLElement): string[] {
	const cells = Array.from(row.querySelectorAll<HTMLElement>(":scope > [data-testid]"));
	return cells
		.filter((cell) => isVisibleCell(cell))
		.map((cell) => cell.dataset.testid ?? "")
		.filter(Boolean);
}

function getVisibleFreeColumns(row: HTMLElement): ResizableColumn[] {
	const visibleColumns = getVisibleColumnOrder(row);
	return visibleColumns.filter((col): col is ResizableColumn => !NON_FREE_COLUMNS.has(col));
}

function getVisibleResizableColumns(row: HTMLElement): ResizableColumn[] {
	const freeColumns = getVisibleFreeColumns(row);
	const anchorColumn = freeColumns[freeColumns.length - 1];
	const resizableSet = new Set<string>([...RESIZABLE_COLUMNS, "deposit", "balance"]);
	return freeColumns.filter((col): col is ResizableColumn => col !== anchorColumn && resizableSet.has(col));
}

function findHeaderRow(): HTMLElement | null {
	const amountIds = new Set(["payment", "debit", "deposit", "credit", "balance"]);
	const isHeaderLike = (container: HTMLElement): boolean => {
		const directCells = Array.from(container.querySelectorAll<HTMLElement>(":scope > [data-testid]"));
		if (directCells.length < 4) return false;
		const ids = directCells.map((cell) => cell.dataset.testid ?? "");
		return ids.includes("date") && ids.some((id) => amountIds.has(id));
	};

	const rows = document.querySelectorAll<HTMLElement>("[data-testid='row']");
	for (const row of rows) {
		if (isHeaderLike(row)) {
			return row;
		}
	}

	// Fallback: derive a header-like container from known cell parents even when
	// the row wrapper no longer exposes data-testid='row'.
	const anchorCells = document.querySelectorAll<HTMLElement>(
		"[data-testid='date'], [data-testid='payee'], [data-testid='account'], [data-testid='category']",
	);
	const visited = new Set<HTMLElement>();
	for (const cell of anchorCells) {
		let parent = cell.parentElement;
		let depth = 0;
		while (parent && depth < 4) {
			if (!visited.has(parent)) {
				visited.add(parent);
				if (isHeaderLike(parent)) {
					return parent;
				}
			}
			parent = parent.parentElement;
			depth += 1;
		}
	}

	return null;
}

function getCellWidth(row: HTMLElement, testId: string): number {
	const cell = row.querySelector<HTMLElement>(`[data-testid='${testId}']`);
	return cell ? cell.getBoundingClientRect().width : 0;
}

function getHardMaxWidth(column: ResizableColumn): number {
	return NUMERIC_MAX_WIDTH[column] ?? MAX_COL_WIDTH_SAFETY;
}

function getMaxResizableWidth(column: ResizableColumn): number {
	const headerRow = findHeaderRow();
	if (!headerRow) return getHardMaxWidth(column);

	const containerWidth = headerRow.getBoundingClientRect().width;
	let reserved = 0;

	const visibleColumns = getVisibleColumnOrder(headerRow);
	for (const other of visibleColumns) {
		if (other === column) continue;

		const current = getCellWidth(headerRow, other);
		const isKnownColumn = HEADER_COLUMNS.includes(other as HeaderColumn);
		const isFlexDonor =
			isKnownColumn &&
			FLEX_DEFAULT_COLUMNS.has(other as HeaderColumn) &&
			typeof cachedWidths[other as HeaderColumn] !== "number";
		reserved += isFlexDonor ? Math.min(current, FLEX_SHRINK_FLOOR) : current;
	}

	return Math.max(MIN_COL_WIDTH, Math.min(getHardMaxWidth(column), Math.floor(containerWidth - reserved)));
}

function getMinWidth(column: ResizableColumn): number {
	return FLEX_DEFAULT_COLUMNS.has(column) ? FLEX_SHRINK_FLOOR : MIN_COL_WIDTH;
}

function getNextResizableColumn(column: ResizableColumn, headerRow: HTMLElement): ResizableColumn | null {
	const freeColumns = getVisibleFreeColumns(headerRow);
	const index = freeColumns.indexOf(column);
	if (index === -1) return null;
	return freeColumns[index + 1] ?? null;
}

function addHandle(cell: HTMLElement, column: ResizableColumn): void {
	if (cell.querySelector(`.${RESIZE_HANDLE_CLASS}`)) return;

	const handle = createElement("div", {
		className: RESIZE_HANDLE_CLASS,
		title: `Resize ${column} column`,
	}) as HTMLDivElement;

	handle.addEventListener("pointerdown", (event: PointerEvent) => {
		event.preventDefault();
		event.stopPropagation();
		document.documentElement.setAttribute(ROOT_RESIZING_ATTR, "on");
		handle.setPointerCapture(event.pointerId);
		handle.dataset.dragging = "true";

		const startX = event.clientX;
		const startWidth = cell.getBoundingClientRect().width;
		let latestX = startX;
		let framePending = false;

		const headerRow = findHeaderRow();
		if (!headerRow || !isVisibleColumn(headerRow, column)) return;

		const nextColumn = getNextResizableColumn(column, headerRow);
		const nextCell = nextColumn && headerRow ? getColumnCell(headerRow, nextColumn) : null;
		const startNextWidth = nextCell?.getBoundingClientRect().width ?? 0;

		const applyDrag = () => {
			framePending = false;

			const deltaX = latestX - startX;

			if (nextColumn && nextCell) {
				const rawDelta = deltaX;
				const minDelta = Math.max(
					getMinWidth(column) - startWidth,
					startNextWidth - getHardMaxWidth(nextColumn),
				);
				const maxDelta = Math.min(
					getHardMaxWidth(column) - startWidth,
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
			document.documentElement.removeAttribute(ROOT_RESIZING_ATTR);
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

function createSvgIcon(): SVGSVGElement {
	const ns = "http://www.w3.org/2000/svg";

	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("width", "16");
	svg.setAttribute("height", "16");
	svg.setAttribute("viewBox", "0 0 15 15");
	svg.setAttribute("fill", "none");
	svg.setAttribute("aria-hidden", "true");

	const path = document.createElementNS(ns, "path");
	path.setAttribute("d", "M7.50009 1C7.77623 1 8.00009 1.22386 8.00009 1.5V13.5C8.00009 13.7761 7.77623 14 7.50009 14C7.22395 14 7.00009 13.7761 7.00009 13.5V1.5C7.00009 1.22386 7.22395 1 7.50009 1ZM11.6817 5.18164C11.8356 5.0278 12.0734 5.00851 12.2481 5.12402L12.3184 5.18164L14.3184 7.18164L14.3761 7.25195C14.4914 7.42662 14.4722 7.66458 14.3184 7.81836L12.3184 9.81836C12.1428 9.99403 11.8575 9.9939 11.6817 9.81836C11.506 9.64262 11.506 9.35738 11.6817 9.18164L12.9132 7.9502H9.50009C9.25174 7.95006 9.05 7.74836 9.04989 7.5C9.04989 7.25155 9.25167 7.04994 9.50009 7.0498H12.9132L11.6817 5.81836L11.6241 5.74805C11.5086 5.57335 11.5279 5.33548 11.6817 5.18164ZM2.75204 5.12402C2.92673 5.00854 3.16462 5.02781 3.31845 5.18164C3.47211 5.33549 3.49153 5.57343 3.37606 5.74805L3.31845 5.81836L2.087 7.0498H5.50009L5.59091 7.05957C5.79587 7.10161 5.95028 7.28261 5.95028 7.5C5.95019 7.71733 5.79584 7.89843 5.59091 7.94043L5.50009 7.9502H2.087L3.31845 9.18164L3.37606 9.25195C3.49141 9.42662 3.47222 9.66458 3.31845 9.81836C3.16467 9.97214 2.92671 9.99132 2.75204 9.87598L2.68173 9.81836L0.681729 7.81836C0.505993 7.64262 0.505993 7.35738 0.681729 7.18164L2.68173 5.18164L2.75204 5.12402Z");
	path.setAttribute("fill", "currentColor");
	svg.appendChild(path);

	return svg;
}

function attachResetButton(): void {
	createToolbarButton({
		id: "abt-transaction-col-reset-btn",
		title: "Reset all column widths",
		icon: createSvgIcon(),
		onClick: () => void resetAllWidths(),
	});
}

function attachHandles(): void {
	const headerRow = findHeaderRow();
	observeHeaderRow(headerRow);
	if (!headerRow) {
		return;
	}

	const resizable = new Set<string>(getVisibleResizableColumns(headerRow));

	// Remove handles from columns that are now the anchor or hidden.
	headerRow.querySelectorAll<HTMLElement>(`.${RESIZE_HANDLE_CLASS}`).forEach((handle) => {
		const testId = handle.parentElement?.dataset.testid;
		if (testId && !resizable.has(testId)) {
			handle.remove();
		}
	});

	for (const column of resizable) {
		const cell = getColumnCell(headerRow, column);
		if (cell) {
			addHandle(cell, column as ResizableColumn);
		}
	}

	attachResetButton();
}

function scheduleAttachHandles(): void {
	// Some app navigations can mutate the URL without going through our patched
	// history methods. Re-check route key on each attach cycle as a fallback.
	onRouteSignal();
	if (scheduled) {
		return;
	}
	scheduled = true;
	requestAnimationFrame(() => {
		scheduled = false;
		attachHandles();
	});
}

function scheduleInitialAttachRetries(): void {
	let attempts = 0;

	const tick = () => {
		attempts += 1;
		scheduleAttachHandles();
		if (findHeaderRow() || attempts >= INITIAL_ATTACH_RETRY_FRAMES) {
			return;
		}
		requestAnimationFrame(tick);
	};

	requestAnimationFrame(tick);
}

function ensureInitialAttachObserver(): void {
	if (initialAttachObserver || !document.body) {
		return;
	}

	initialAttachObserver = new MutationObserver(() => {
		const headerRow = findHeaderRow();
		if (!headerRow) {
			return;
		}

		observeHeaderRow(headerRow);
		scheduleAttachHandles();
		initialAttachObserver?.disconnect();
		initialAttachObserver = null;
	});

	initialAttachObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});
}

function startObserving(): void {
	observedRouteKey = getCurrentRouteKey();
	installRouteListeners();
	const headerRow = findHeaderRow();
	observeHeaderRow(headerRow);
	void syncPageWidths();
	scheduleAttachHandles();
	scheduleInitialAttachRetries();
	if (!headerRow) {
		ensureInitialAttachObserver();
	}
}

function stopObserving(): void {
	if (headerObserver) {
		headerObserver.disconnect();
		headerObserver = null;
	}
	if (initialAttachObserver) {
		initialAttachObserver.disconnect();
		initialAttachObserver = null;
	}
	observedHeaderRow = null;
	uninstallRouteListeners();
	if (routeRefreshTimer !== null) {
		window.clearTimeout(routeRefreshTimer);
		routeRefreshTimer = null;
	}
}

export const resizableTransactionColumns = defineSetting({
	type: "checkbox",
	label: "Resizable Transaction Columns",
	context: {
		key: "resizable-transaction-columns",
		defaultValue: true,
		css: `
			:root[${ROOT_TOGGLE_ATTR}="on"]:not(:has([data-testid="budget-table"])) [data-testid="row"] {
				position: relative;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="account"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="payee"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="notes"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="category"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="payment"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="debit"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="deposit"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="credit"],
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-testid="balance"] {
				position: relative;
				padding-right: 8px;
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
			:root[${ROOT_TOGGLE_ATTR}="on"]:not(:has([data-testid="budget-table"])) [data-testid="balance"] {
				width: var(--abt-col-balance, 100px) !important;
				min-width: var(--abt-col-balance-min, 100px) !important;
				max-width: var(--abt-col-balance-max, 100px) !important;
				flex: var(--abt-col-balance-flex, 0 0 100px) !important;
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

		storagePrefixKey = ctx.key;
		currentStorageKey = "";
		cachedWidths = {};

		applyGlobalCSS(ctx.css, ctx.key);
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		await syncPageWidths(true);
		startObserving();
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (!value) {
			stopObserving();
			removeHandles();
			document.documentElement.removeAttribute(ROOT_TOGGLE_ATTR);
			document.documentElement.removeAttribute(ROOT_RESIZING_ATTR);
			storagePrefixKey = "";
			currentStorageKey = "";
			applyGlobalCSS("", ctx.key);
			return;
		}

		storagePrefixKey = ctx.key;
		currentStorageKey = "";
		cachedWidths = {};

		applyGlobalCSS(ctx.css, ctx.key);
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		await syncPageWidths(true);
		startObserving();
	},
});
