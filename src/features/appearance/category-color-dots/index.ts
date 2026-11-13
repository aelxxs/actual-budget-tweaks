import { defineSetting } from "@features/types";
import { rowCategoryId } from "@lib/utilities/budget-cells";
import {
	getCategoryColor,
	loadCategoryColors,
	setCategoryColor,
} from "@lib/utilities/category-colors";
import { CATEGORY_ID_ATTR, trackCategoryIds } from "@lib/utilities/category-ids";
import { watchDom } from "@lib/utilities/dom-watcher";
import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import ColorPicker from "./ColorPicker.svelte";
import { CATEGORY_CELL, CATEGORY_NAME, ROW } from "@lib/actual-dom";

const STORAGE_KEY = "category-color-dots";
const ATTR = "data-abt-color-dot";

const CSS = `
	.abt-cat-dot {
		width: 7px;
		height: 7px;
		border-radius: var(--abt-radius-pill);
		border: none;
		padding: 0;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.08s;
		margin-right: var(--abt-space-2);
	}

	.abt-cat-dot:hover {
		transform: scale(.85);
	}

	.abt-tx-cat-dot {
		width: 7px;
		height: 7px;
		border-radius: var(--abt-radius-pill);
		flex-shrink: 0;
		display: inline-block;
		margin-right: 5px;
		vertical-align: middle;
	}

	.abt-color-popover {
		position: fixed;
		z-index: 10000;
	}
`;

let popover: Mounted | null = null;
let stopOutsideClick: (() => void) | null = null;

function closePopover() {
	stopOutsideClick?.();
	stopOutsideClick = null;
	popover?.destroy();
	popover = null;
}

function openColorPicker(anchor: HTMLElement, catId: string) {
	closePopover();

	const currentColor = getCategoryColor(catId);

	popover = mountToNodeWithReturn(ColorPicker, {
		currentColor,
		onSelect: async (color: string) => {
			await setCategoryColor(catId, color);
			anchor.style.background = color;
			closePopover();
		},
		onClose: closePopover,
	});

	const wrap = popover.node;
	wrap.className = "abt-color-popover abt-popover";
	wrap.style.display = "block";
	document.body.appendChild(wrap);

	positionPopover(wrap, anchor);
	stopOutsideClick = onOutsideClick([wrap, anchor], closePopover);
}

const dotColors = new WeakMap<HTMLElement, string>();

function decorateRow(row: HTMLElement) {
	const nameEl = row.querySelector<HTMLElement>(CATEGORY_NAME);
	if (!nameEl) {
		return;
	}

	const catId = rowCategoryId(row);
	if (!catId) {
		return;
	}

	if (row.getAttribute(ATTR) === catId) {
		const existing = nameEl.parentElement?.querySelector<HTMLElement>(".abt-cat-dot");
		const color = getCategoryColor(catId);
		// This runs on every DOM change, so it writes only a colour that changed.
		if (existing && dotColors.get(existing) !== color) {
			existing.style.background = color;
			dotColors.set(existing, color);
		}
		return;
	}
	row.setAttribute(ATTR, catId);

	nameEl.parentElement?.querySelector(".abt-cat-dot")?.remove();

	const dot = document.createElement("button");
	dot.className = "abt-cat-dot";
	const color = getCategoryColor(catId);
	dot.style.background = color;
	dotColors.set(dot, color);
	dot.title = "Change category color";
	dot.addEventListener("click", (e) => {
		e.stopPropagation();
		openColorPicker(dot, catId);
	});

	nameEl.parentElement?.insertBefore(
		dot,
		nameEl.parentElement.querySelector(".abt-emoji-btn") || nameEl,
	);
}

function decorateCell(cell: HTMLElement) {
	const catId = cell.getAttribute(CATEGORY_ID_ATTR);
	const dot = cell.querySelector<HTMLElement>(".abt-tx-cat-dot");
	if (!catId) {
		dot?.remove();
		return;
	}

	const color = getCategoryColor(catId);
	if (dot) {
		if (dotColors.get(dot) !== color) {
			dot.style.background = color;
			dotColors.set(dot, color);
		}
		return;
	}

	const textEl = cell.querySelector("span");
	if (!textEl) {
		return;
	}
	const added = document.createElement("span");
	added.className = "abt-tx-cat-dot";
	added.style.background = color;
	dotColors.set(added, color);
	textEl.parentElement?.insertBefore(added, textEl);
}

function scanRows() {
	for (const name of document.querySelectorAll(CATEGORY_NAME)) {
		const row = name.closest<HTMLElement>(ROW);
		if (row) {
			decorateRow(row);
		}
	}
	for (const cell of document.querySelectorAll<HTMLElement>(CATEGORY_CELL)) {
		decorateCell(cell);
	}
}

function cleanup() {
	closePopover();
	for (const row of document.querySelectorAll<HTMLElement>(`[${ATTR}]`)) {
		row.removeAttribute(ATTR);
		row.querySelector(".abt-cat-dot")?.remove();
	}
	for (const dot of document.querySelectorAll(".abt-tx-cat-dot")) {
		dot.remove();
	}
}

export const categoryColorDots = defineSetting({
	type: "checkbox",
	label: "Category color dots",
	description: "Gives each category a colored dot in the budget and transactions.",
	group: "Categories",
	icon: "palette",
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	css: () => CSS,
	init: async () => {
		await loadCategoryColors();
		const stopTracking = trackCategoryIds();
		const unwatch = watchDom(scanRows);

		return () => {
			unwatch();
			stopTracking();
			cleanup();
		};
	},
});
