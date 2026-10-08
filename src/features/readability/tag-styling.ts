import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";

const STORAGE_KEY = "tag-styling";
const ATTR = "data-abt-tag";

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
	if (!m) return null;
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
	if (!els.length) return;
	for (const el of els) el.style.removeProperty("background-color");
	const colors = els.map((el) => parseRgb(getComputedStyle(el).backgroundColor));
	els.forEach((el, i) => {
		el.dataset.abtTagClass = el.className;
		const rgb = colors[i];
		if (!rgb) return;
		const [r, g, b] = rgb;
		el.style.setProperty("background-color", `rgba(${r}, ${g}, ${b}, 0.15)`, "important");
		el.style.setProperty("color", tagText(r, g, b), "important");
	});
}

function splitHash(el: HTMLElement) {
	const text = el.textContent?.trim() || "";
	if (!text.startsWith("#")) return;

	const hash = document.createElement("span");
	hash.className = "abt-tag-hash";
	hash.textContent = "#";

	el.textContent = text.slice(1);
	el.prepend(hash);
}

function scanTags() {
	const stale: HTMLElement[] = [];
	for (const btn of document.querySelectorAll<HTMLButtonElement>(
		'button[data-react-aria-pressable="true"]',
	)) {
		if (btn.hasAttribute(ATTR)) {
			if (needsColors(btn)) stale.push(btn);
		} else if (btn.textContent?.trim().startsWith("#")) {
			btn.setAttribute(ATTR, "");
			splitHash(btn);
			stale.push(btn);
		}
	}
	for (const item of document.querySelectorAll<HTMLElement>(".react-aria-ListBoxItem")) {
		const textEl = item.querySelector<HTMLElement>("div");
		if (!textEl) continue;
		if (item.hasAttribute(ATTR)) {
			if (needsColors(textEl)) stale.push(textEl);
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
		if (el.tagName === "BUTTON") {
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
	label: "Tag Styling",
	description: "Color #tags in notes and transaction fields.",
	group: "Transactions",
	icon: "palette",
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(scanTags);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
