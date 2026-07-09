import { defineSetting } from "@features/types";
import { query } from "@lib/utilities/actual-api";
import { getCategoryColor, loadCategoryColors, setCategoryColor } from "@lib/utilities/category-colors";
import { watchDom } from "@lib/utilities/dom-watcher";
import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
import { mountToNode } from "@lib/utilities/svelte";
import ColorPicker from "./ColorPicker.svelte";

const STORAGE_KEY = "category-color-dots";
const ATTR = "data-abt-color-dot";
const TX_ATTR = "data-abt-tx-dot";
const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
const ROW_SELECTOR = '[data-testid="row"]:has([data-testid="category-name"])';

let categoryNameToId = new Map<string, string>();
let categoryMapLoaded = false;

async function loadCategoryMap() {
	if (categoryMapLoaded) return;
	try {
		const cats = await query<{ id: string; name: string }[]>("categories");
		categoryNameToId = new Map(cats.map((c) => [c.name, c.id]));
		categoryMapLoaded = true;
	} catch {
		// Bridge not ready
	}
}

const CSS = `
	.abt-cat-dot {
		width: 8.5px;
		height: 8.5px;
		border-radius: 50%;
		border: none;
		padding: 0;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.08s;
		margin-right: 4px;
	}

	.abt-cat-dot:hover {
		transform: scale(.85);
	}

	.abt-tx-cat-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
		display: inline-block;
		margin-right: 5px;
		vertical-align: middle;
	}

	.abt-color-popover {
		position: fixed;
		z-index: 10000;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	}
`;

let popoverEl: HTMLElement | null = null;
let stopOutsideClick: (() => void) | null = null;

function getCategoryIdForRow(row: HTMLElement): string | null {
	const idSrc = row.querySelector('[data-testid*="sum-amount-"], [data-testid*="leftover-"]');
	if (!idSrc) return null;
	const m = (idSrc.getAttribute("data-testid") || "").match(UUID_RE);
	return m ? m[1] : null;
}

function closePopover() {
	stopOutsideClick?.();
	stopOutsideClick = null;
	if (popoverEl) {
		popoverEl.remove();
		popoverEl = null;
	}
}

function openColorPicker(anchor: HTMLElement, catId: string) {
	closePopover();

	const currentColor = getCategoryColor(catId);

	const wrap = mountToNode(ColorPicker, {
		currentColor,
		onSelect: async (color: string) => {
			await setCategoryColor(catId, color);
			anchor.style.background = color;
			closePopover();
		},
		onClose: closePopover,
	});

	wrap.className = "abt-color-popover";
	wrap.style.display = "block";
	document.body.appendChild(wrap);
	popoverEl = wrap;

	positionPopover(wrap, anchor);
	stopOutsideClick = onOutsideClick([wrap, anchor], closePopover);
}

function decorateRow(row: HTMLElement) {
	const nameEl = row.querySelector<HTMLElement>('[data-testid="category-name"]');
	if (!nameEl) return;

	const catId = getCategoryIdForRow(row);
	if (!catId) return;

	if (row.getAttribute(ATTR) === catId) {
		const existing = nameEl.parentElement?.querySelector<HTMLElement>(".abt-cat-dot");
		if (existing) existing.style.background = getCategoryColor(catId);
		return;
	}
	row.setAttribute(ATTR, catId);

	nameEl.parentElement?.querySelector(".abt-cat-dot")?.remove();

	const dot = document.createElement("button");
	dot.className = "abt-cat-dot";
	dot.style.background = getCategoryColor(catId);
	dot.title = "Change category color";
	dot.addEventListener("click", (e) => {
		e.stopPropagation();
		openColorPicker(dot, catId);
	});

	nameEl.parentElement?.insertBefore(dot, nameEl.parentElement.querySelector(".abt-emoji-btn") || nameEl);
}

function decorateTransactionRow(row: HTMLElement) {
	const catCell = row.querySelector<HTMLElement>('[data-testid="category"]');
	if (!catCell) return;

	const textEl = catCell.querySelector("span");
	if (!textEl) return;

	const catName = textEl.textContent?.trim() || "";
	if (!catName || catName === "Categorize" || catName === "Upcoming" || catName === "Missed" || catName === "Split")
		return;

	const fp = catName;
	if (row.getAttribute(TX_ATTR) === fp) return;
	row.setAttribute(TX_ATTR, fp);

	catCell.querySelector(".abt-tx-cat-dot")?.remove();

	const catId = categoryNameToId.get(catName);
	if (!catId) return;

	const dot = document.createElement("span");
	dot.className = "abt-tx-cat-dot";
	dot.style.background = getCategoryColor(catId);

	const wrapper = textEl.parentElement;
	if (wrapper) wrapper.insertBefore(dot, textEl);
}

function scanRows() {
	for (const row of document.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
		decorateRow(row);
	}
	for (const row of document.querySelectorAll<HTMLElement>('[data-testid="row"]:has([data-testid="category"])')) {
		decorateTransactionRow(row);
	}
}

function cleanup() {
	closePopover();
	for (const row of document.querySelectorAll<HTMLElement>(`[${ATTR}]`)) {
		row.removeAttribute(ATTR);
		row.querySelector(".abt-cat-dot")?.remove();
	}
	for (const row of document.querySelectorAll<HTMLElement>(`[${TX_ATTR}]`)) {
		row.removeAttribute(TX_ATTR);
		row.querySelector(".abt-tx-cat-dot")?.remove();
	}
}

export const categoryColorDots = defineSetting({
	type: "checkbox",
	label: "Category Color Dots",
	description: "Show a colored dot for each transaction's category.",
	group: "Categories",
	icon: "palette",
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	css: () => CSS,
	init: async () => {
		await Promise.all([loadCategoryColors(), loadCategoryMap()]);
		const unwatch = watchDom(scanRows);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
