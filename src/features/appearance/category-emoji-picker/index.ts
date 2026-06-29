import { defineSetting } from "@features/types";
import { send } from "@lib/utilities/actual-api";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";
import { mountToNode } from "@lib/utilities/svelte";
import EmojiPicker from "./EmojiPicker.svelte";

const STORAGE_KEY = "category-emoji-picker";
const ATTR = "data-abt-emoji";
const ROW_SELECTOR = '[data-testid="row"]:has([data-testid="category-name"])';
const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Emoji}️)\s*/u;

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
		flex-shrink: 0;
		transition: background 0.08s;
		vertical-align: middle;
	}

	.abt-emoji-btn:hover {
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}


	.abt-emoji-hidden {
		display: none;
	}

	.abt-emoji-popover {
		position: fixed;
		z-index: 10000;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	}
`;

let enabled = false;
let observer: MutationObserver | null = null;
let popoverEl: HTMLElement | null = null;

function isBudgetRoute() {
	return location.pathname === "/budget" || location.pathname.startsWith("/budget");
}

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
	if (popoverEl) {
		popoverEl.remove();
		popoverEl = null;
	}
}

function openPicker(anchor: HTMLElement, catId: string, currentName: string) {
	closePopover();

	const { emoji: currentEmoji } = extractEmoji(currentName);

	const wrap = mountToNode(EmojiPicker, {
		hasEmoji: !!currentEmoji,
		onSelect: (emoji: string) => {
			const { rest } = extractEmoji(currentName);
			updateCategoryName(catId, emoji + " " + rest);
			closePopover();
		},
		onRemove: () => {
			const { rest } = extractEmoji(currentName);
			updateCategoryName(catId, rest);
			closePopover();
		},
		onClose: closePopover,
	});

	wrap.className = "abt-emoji-popover";
	wrap.style.display = "block";
	document.body.appendChild(wrap);
	popoverEl = wrap;

	const rect = anchor.getBoundingClientRect();
	const popRect = wrap.getBoundingClientRect();
	let top = rect.bottom + 4;
	let left = rect.left;

	if (top + popRect.height > window.innerHeight - 8) {
		top = Math.max(8, rect.top - popRect.height - 4);
	}
	if (left + popRect.width > window.innerWidth - 8) {
		left = Math.max(8, window.innerWidth - popRect.width - 8);
	}

	wrap.style.top = `${top}px`;
	wrap.style.left = `${left}px`;

	const onOutside = (e: MouseEvent) => {
		if (!wrap.contains(e.target as Node) && e.target !== anchor) {
			closePopover();
			document.removeEventListener("mousedown", onOutside);
		}
	};
	setTimeout(() => document.addEventListener("mousedown", onOutside), 0);
}

function decorateRow(row: HTMLElement) {
	const nameEl = row.querySelector<HTMLElement>('[data-testid="category-name"]');
	if (!nameEl) return;

	const catId = getCategoryIdForRow(row);
	if (!catId) return;

	const currentText = nameEl.textContent || "";
	const fingerprint = `${catId}:${currentText}`;
	if (row.getAttribute(ATTR) === fingerprint) return;
	row.setAttribute(ATTR, fingerprint);

	// Clean up previous decoration
	nameEl.parentElement?.querySelector(".abt-emoji-btn")?.remove();

	const { emoji } = extractEmoji(currentText);
	if (!emoji) return;

	// Hide the emoji in the original text via CSS, show our button instead
	const textNode = nameEl.firstChild;
	if (textNode?.nodeType === Node.TEXT_NODE) {
		const span = document.createElement("span");
		span.className = "abt-emoji-hidden";
		span.textContent = emoji + " ";
		const rest = document.createTextNode(currentText.replace(EMOJI_RE, ""));
		nameEl.replaceChildren(span, rest);
	}

	const btn = document.createElement("button");
	btn.className = "abt-emoji-btn";
	btn.textContent = emoji;
	btn.title = "Change emoji";
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		openPicker(btn, catId, currentText);
	});
	nameEl.parentElement?.insertBefore(btn, nameEl);
}

function scanRows() {
	if (!isBudgetRoute()) return;
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

function startObserver() {
	if (observer) return;
	let scheduled = false;
	observer = new MutationObserver(() => {
		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(() => {
				scheduled = false;
				scanRows();
			});
		}
	});
	observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopObserver() {
	observer?.disconnect();
	observer = null;
}

export const categoryEmojiPicker = defineSetting({
	type: "checkbox",
	label: "Category Emoji Picker",
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	init: async (ctx) => {
		enabled = Boolean(await getValue(ctx.key, ctx.defaultValue));
		if (!enabled) return;
		applyGlobalCSS(CSS, STORAGE_KEY);
		scanRows();
		startObserver();
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		enabled = value;
		if (value) {
			applyGlobalCSS(CSS, STORAGE_KEY);
			scanRows();
			startObserver();
		} else {
			stopObserver();
			cleanup();
			applyGlobalCSS("", STORAGE_KEY);
		}
	},
});
