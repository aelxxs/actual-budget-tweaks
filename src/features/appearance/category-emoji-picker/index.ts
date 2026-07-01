import { defineSetting } from "@features/types";
import type { IconPickerResult } from "@lib/components/IconPickerPopover.svelte";
import IconPickerPopover from "@lib/components/IconPickerPopover.svelte";
import { send } from "@lib/utilities/actual-api";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { getValue, setValue } from "@lib/utilities/store";
import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import { unmount } from "svelte";

const STORAGE_KEY = "category-emoji-picker";
const ICONS_KEY = "abt-category-icons";
const ATTR = "data-abt-emoji";
const ROW_SELECTOR = '[data-testid="row"]:has([data-testid="category-name"])';
const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Emoji}️)\s*/u;

// ── Category icon storage ────────────────────────────────────────
type CategoryIcon = { type: "url" | "dataUrl"; value: string };
let categoryIcons: Record<string, CategoryIcon> = {};

async function loadCategoryIcons(): Promise<void> {
	categoryIcons = (await getValue<Record<string, CategoryIcon>>(ICONS_KEY, {})) ?? {};
}

async function setCategoryIcon(catId: string, icon: CategoryIcon): Promise<void> {
	categoryIcons = { ...categoryIcons, [catId]: icon };
	await setValue(ICONS_KEY, categoryIcons);
}

async function removeCategoryIcon(catId: string): Promise<void> {
	const { [catId]: _, ...rest } = categoryIcons;
	categoryIcons = rest;
	await setValue(ICONS_KEY, categoryIcons);
}

// ── CSS ──────────────────────────────────────────────────────────
const CSS = `
	.abt-emoji-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		border-radius: 3px;
		background: none;
		cursor: pointer;
		font-size: 13px;
		line-height: 1;
		padding: 0;
		margin-right: 1px;
		flex-shrink: 0;
		transition: background 0.08s, opacity 0.1s;
		vertical-align: middle;
	}

	.abt-emoji-btn:hover {
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}

	.abt-emoji-btn--empty {
		display: none;
	}

	[data-testid="row"]:hover .abt-emoji-btn--empty {
		display: inline-flex;
		opacity: 0.4;
	}

	[data-testid="row"] .abt-emoji-btn--empty:hover {
		opacity: 1;
	}

	.abt-emoji-btn img {
		width: 14px;
		height: 14px;
		object-fit: contain;
		border-radius: 2px;
		display: block;
		pointer-events: none;
	}

	.abt-emoji-hidden {
		display: none;
	}

	.abt-emoji-popover {
		position: fixed;
		z-index: 10000;
	}
`;

let stopWatching: (() => void) | null = null;
let popoverEl: HTMLElement | null = null;
let popoverInstance: any = null;

function extractEmoji(name: string): { emoji: string | null; rest: string } {
	const m = name.match(EMOJI_RE);
	if (m) return { emoji: m[1], rest: name.slice(m[0].length) };
	return { emoji: null, rest: name };
}

function getCategoryIdForRow(row: HTMLElement): string | null {
	const idSrc = row.querySelector('[data-testid*="sum-amount-"], [data-testid*="leftover-"]');
	if (!idSrc) return null;
	const m = (idSrc.getAttribute("data-testid") || "").match(
		/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/,
	);
	return m ? m[1] : null;
}

async function updateCategoryName(catId: string, newName: string) {
	try {
		await send("category-update", { id: catId, name: newName });
	} catch (err) {
		console.warn("[ABT Emoji] Failed to update category:", err);
	}
}

function closePopover() {
	if (popoverInstance) {
		unmount(popoverInstance);
		popoverInstance = null;
	}
	if (popoverEl) {
		popoverEl.remove();
		popoverEl = null;
	}
}

const EMPTY_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="var(--color-pageText)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" style="pointer-events:none"><circle cx="8" cy="8" r="5.5"/><line x1="8" y1="5.5" x2="8" y2="10.5"/><line x1="5.5" y1="8" x2="10.5" y2="8"/></svg>`;

function renderBtnContent(btn: HTMLButtonElement, catId: string, emoji: string | null) {
	btn.innerHTML = "";
	const storedIcon = categoryIcons[catId];
	if (storedIcon) {
		const img = document.createElement("img");
		img.src = storedIcon.value;
		img.alt = "";
		btn.appendChild(img);
	} else if (emoji) {
		btn.textContent = emoji;
	} else {
		btn.innerHTML = EMPTY_SVG;
	}
}

function openPicker(anchor: HTMLElement, catId: string, currentName: string) {
	closePopover();

	const { emoji: currentEmoji } = extractEmoji(currentName);
	const hasIcon = !!currentEmoji || !!categoryIcons[catId];

	const { node, instance } = mountToNodeWithReturn(IconPickerPopover, {
		anchorRect: anchor.getBoundingClientRect(),
		hasIcon,
		onSelect: async (result: IconPickerResult) => {
			if (result.type === "emoji") {
				await removeCategoryIcon(catId);
				const { rest } = extractEmoji(currentName);
				await updateCategoryName(catId, result.value + " " + rest);
			} else {
				await setCategoryIcon(catId, { type: result.type as "url" | "dataUrl", value: result.value });
				if (currentEmoji) {
					const { rest } = extractEmoji(currentName);
					await updateCategoryName(catId, rest);
				}
				renderBtnContent(anchor as HTMLButtonElement, catId, null);
			}
			closePopover();
		},
		onRemove: async () => {
			await removeCategoryIcon(catId);
			const { rest } = extractEmoji(currentName);
			if (currentEmoji) await updateCategoryName(catId, rest);
			closePopover();
		},
		onClose: closePopover,
	});

	node.className = "abt-emoji-popover";
	node.style.display = "block";
	document.body.appendChild(node);
	popoverEl = node;
	popoverInstance = instance;
}

function decorateRow(row: HTMLElement) {
	const nameEl = row.querySelector<HTMLElement>('[data-testid="category-name"]');
	if (!nameEl) return;

	const catId = getCategoryIdForRow(row);
	if (!catId) return;

	const currentText = nameEl.textContent || "";
	const { emoji } = extractEmoji(currentText);
	const storedIcon = categoryIcons[catId];

	// Fingerprint includes stored icon so we re-render when it changes
	const fingerprint = `${catId}:${currentText}:${storedIcon?.value ?? ""}`;
	if (row.getAttribute(ATTR) === fingerprint) return;
	row.setAttribute(ATTR, fingerprint);

	// Clean up previous decoration
	nameEl.parentElement?.querySelector(".abt-emoji-btn")?.remove();

	// Hide the emoji text in the name if present
	if (emoji) {
		const textNode = nameEl.firstChild;
		if (textNode?.nodeType === Node.TEXT_NODE) {
			const span = document.createElement("span");
			span.className = "abt-emoji-hidden";
			span.textContent = emoji + " ";
			const rest = document.createTextNode(currentText.replace(EMOJI_RE, ""));
			nameEl.replaceChildren(span, rest);
		}
	}

	const btn = document.createElement("button");
	const hasAnyIcon = !!emoji || !!storedIcon;
	btn.className = hasAnyIcon ? "abt-emoji-btn" : "abt-emoji-btn abt-emoji-btn--empty";
	btn.title = hasAnyIcon ? "Change icon" : "Add icon";
	renderBtnContent(btn, catId, emoji);

	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		openPicker(btn, catId, currentText);
	});
	nameEl.parentElement?.insertBefore(btn, nameEl);
}

function scanRows() {
	if (!matchesPage(Page.Budget)) return;
	for (const row of document.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
		decorateRow(row);
	}
}

function cleanup() {
	closePopover();
	for (const row of document.querySelectorAll<HTMLElement>(`[${ATTR}]`)) {
		row.removeAttribute(ATTR);
		const nameEl = row.querySelector<HTMLElement>('[data-testid="category-name"]');
		if (!nameEl) continue;
		nameEl.parentElement?.querySelector(".abt-emoji-btn")?.remove();
	}
}

export const categoryEmojiPicker = defineSetting({
	type: "checkbox",
	label: "Category Emoji Picker",
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	css: () => CSS,
	init: async () => {
		await loadCategoryIcons();
		const unwatch = watchDom(scanRows, document.body, { childList: true, subtree: true, characterData: true });

		return () => {
			unwatch();
			cleanup();
		};
	},
});
