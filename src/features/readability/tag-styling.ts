import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import TagStylingPreview from "./previews/TagStyling.svelte";
import { OPTION } from "@lib/actual-dom";

const STORAGE_KEY = "tag-styling";
const ATTR = "data-abt-tag";
// Mobile draws a tag as a coloured span in the transaction list's rows, not a button.
const MOBILE_TAG = `${OPTION} span[class]`;

const CSS = `
	button[data-react-aria-pressable][data-abt-tag] {
		font-size: 0.8rem !important;
		font-weight: 600 !important;
		letter-spacing: 0.02em !important;
		padding: 3px 10px 3px 7px !important;
		border-radius: var(--abt-radius-sm) !important;
		border: none !important;
		cursor: pointer;
		transition: filter 0.1s;
		line-height: 1.5 !important;
	}

	button[data-react-aria-pressable][data-abt-tag]:hover {
		filter: brightness(1.2) saturate(1.1);
	}

	[data-abt-tag] .abt-tag-hash {
		opacity: 0.45;
		font-weight: 400;
		margin-right: 1px;
	}

	span[data-abt-tag="mobile"] {
		display: inline-block;
		padding: 1px 7px !important;
		border-radius: var(--abt-radius-sm) !important;
		font-weight: 600 !important;
		letter-spacing: 0.02em;
	}

	.react-aria-ListBoxItem[data-abt-tag] > div {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
		font-size: 0.8rem !important;
		font-weight: 600 !important;
		letter-spacing: 0.02em !important;
		padding: 3px 10px 3px 7px !important;
		border-radius: var(--abt-radius-sm) !important;
		border: none !important;
		cursor: pointer;
		transition: filter 0.1s;
		line-height: 1.5 !important;
		display: inline-block !important;
	}
`;

function parseRgb(color: string): [number, number, number] | null {
	const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (!m) {
		return null;
	}
	return [+m[1], +m[2], +m[3]];
}

// Toward the page's text colour, so it reads in light themes (darker) and dark ones (lighter).
function tagText(r: number, g: number, b: number): string {
	return `color-mix(in srgb, rgb(${r}, ${g}, ${b}) 50%, var(--color-pageText))`;
}

function needsColors(el: HTMLElement): boolean {
	// React swaps the emotion class (which carries the color) on recycled rows, or drops our override.
	return el.className !== el.dataset.abtTagClass || !el.style.getPropertyValue("background-color");
}

// Reading a native color forces a style recalc, so clear every override first, read them all,
// then write: one recalc per pass instead of one per tag.
function colorTags(els: HTMLElement[]) {
	if (!els.length) {
		return;
	}
	for (const el of els) {
		el.style.removeProperty("background-color");
	}
	const colors = els.map((el) => parseRgb(getComputedStyle(el).backgroundColor));
	els.forEach((el, i) => {
		el.dataset.abtTagClass = el.className;
		const rgb = colors[i];
		if (!rgb) {
			return;
		}
		const [r, g, b] = rgb;
		el.style.setProperty("background-color", `rgba(${r}, ${g}, ${b}, 0.15)`, "important");
		el.style.setProperty("color", tagText(r, g, b), "important");
	});
}

function splitHash(el: HTMLElement) {
	const text = el.textContent?.trim() || "";
	if (!text.startsWith("#")) {
		return;
	}

	const hash = document.createElement("span");
	hash.className = "abt-tag-hash";
	hash.textContent = "#";

	el.textContent = text.slice(1);
	el.prepend(hash);
}

/** Actual renders a tag as its button's own text; reading only that skips every other button's subtree. */
function isTagButton(btn: HTMLButtonElement): boolean {
	const first = btn.firstChild;
	return first?.nodeType === Node.TEXT_NODE && !!first.textContent?.trimStart().startsWith("#");
}

function scanTags() {
	const stale: HTMLElement[] = [];
	for (const btn of document.querySelectorAll<HTMLButtonElement>(
		'button[data-react-aria-pressable="true"]',
	)) {
		if (btn.hasAttribute(ATTR)) {
			if (needsColors(btn)) {
				stale.push(btn);
			}
		} else if (isTagButton(btn)) {
			btn.setAttribute(ATTR, "");
			splitHash(btn);
			stale.push(btn);
		}
	}
	// Mobile rows are recycled as the list scrolls, so their text is never rewritten (React would
	// later write into a node it no longer owns); only the colours are set, and redone when the
	// span's class changes with a new tag.
	for (const span of document.querySelectorAll<HTMLElement>(MOBILE_TAG)) {
		if (span.getAttribute(ATTR) === "mobile") {
			if (needsColors(span)) {
				stale.push(span);
			}
		} else if (
			!span.hasAttribute(ATTR) &&
			// The tag itself, not the notes line around it, whose text can start with it too.
			span.childElementCount === 0 &&
			span.textContent?.trim().startsWith("#")
		) {
			span.setAttribute(ATTR, "mobile");
			stale.push(span);
		}
	}
	for (const item of document.querySelectorAll<HTMLElement>(".react-aria-ListBoxItem")) {
		const textEl = item.querySelector<HTMLElement>("div");
		if (!textEl) {
			continue;
		}
		if (item.hasAttribute(ATTR)) {
			if (needsColors(textEl)) {
				stale.push(textEl);
			}
		} else if (textEl.textContent?.trim().startsWith("#")) {
			item.setAttribute(ATTR, "");
			splitHash(textEl);
			stale.push(textEl);
		}
	}
	colorTags(stale);
}

function restoreHash(el: HTMLElement) {
	const hash = el.querySelector(".abt-tag-hash");
	if (hash) {
		const text = "#" + (el.textContent?.trim() || "");
		el.textContent = text;
	}
}

function cleanup() {
	for (const el of document.querySelectorAll<HTMLElement>(`[${ATTR}]`)) {
		if (el.getAttribute(ATTR) === "mobile") {
			el.style.removeProperty("background-color");
			el.style.removeProperty("color");
		} else if (el.tagName === "BUTTON") {
			restoreHash(el);
			el.style.removeProperty("background-color");
			el.style.removeProperty("color");
		} else {
			const textEl = el.querySelector<HTMLElement>("div");
			if (textEl) {
				restoreHash(textEl);
				textEl.style.removeProperty("background-color");
				textEl.style.removeProperty("color");
			}
		}
		el.removeAttribute(ATTR);
	}
}

export const tagStyling = defineSetting({
	type: "checkbox",
	label: "Tag styling",
	description: "Shows #tags as colored pills.",
	group: "Transactions",
	icon: "palette",
	preview: TagStylingPreview,
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	platform: "all",
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(scanTags);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
