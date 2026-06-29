import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

const STORAGE_KEY = "tag-styling";
const ATTR = "data-abt-tag";

const CSS = `
	button[data-react-aria-pressable][data-abt-tag] {
		font-size: 0.8rem !important;
		font-weight: 600 !important;
		letter-spacing: 0.02em !important;
		padding: 3px 10px 3px 7px !important;
		border-radius: 4px !important;
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
		border-radius: 4px !important;
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

function lighten(r: number, g: number, b: number, amount: number): string {
	const lr = Math.min(255, r + (255 - r) * amount);
	const lg = Math.min(255, g + (255 - g) * amount);
	const lb = Math.min(255, b + (255 - b) * amount);
	return `rgb(${Math.round(lr)}, ${Math.round(lg)}, ${Math.round(lb)})`;
}

function readNativeBg(el: HTMLElement): string {
	el.style.removeProperty("background-color");
	const bg = getComputedStyle(el).backgroundColor;
	return bg;
}

function applyTagColors(el: HTMLElement) {
	const bg = readNativeBg(el);
	const rgb = parseRgb(bg);
	if (rgb) {
		const [r, g, b] = rgb;
		el.dataset.abtTagBg = `${r},${g},${b}`;
		el.style.setProperty("background-color", `rgba(${r}, ${g}, ${b}, 0.15)`, "important");
		el.style.setProperty("color", lighten(r, g, b, 0.3), "important");
	}
}

function refreshTagColors(el: HTMLElement) {
	const bg = readNativeBg(el);
	const rgb = parseRgb(bg);
	if (!rgb) return;
	const [r, g, b] = rgb;
	const key = `${r},${g},${b}`;
	if (el.dataset.abtTagBg === key) {
		el.style.setProperty("background-color", `rgba(${r}, ${g}, ${b}, 0.15)`, "important");
		return;
	}
	el.dataset.abtTagBg = key;
	el.style.setProperty("background-color", `rgba(${r}, ${g}, ${b}, 0.15)`, "important");
	el.style.setProperty("color", lighten(r, g, b, 0.3), "important");
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

function decorateTagButton(btn: HTMLButtonElement) {
	if (btn.hasAttribute(ATTR)) return;
	const text = btn.textContent?.trim() || "";
	if (!text.startsWith("#")) return;
	btn.setAttribute(ATTR, "");

	applyTagColors(btn);
	splitHash(btn);
}

function decorateTagOption(item: HTMLElement) {
	if (item.hasAttribute(ATTR)) return;
	const textEl = item.querySelector<HTMLElement>("div");
	if (!textEl) return;
	const text = textEl.textContent?.trim() || "";
	if (!text.startsWith("#")) return;
	item.setAttribute(ATTR, "");

	applyTagColors(textEl);
	splitHash(textEl);
}

function scanTags() {
	for (const btn of document.querySelectorAll<HTMLButtonElement>('button[data-react-aria-pressable="true"]')) {
		if (btn.hasAttribute(ATTR)) {
			refreshTagColors(btn);
		} else if (btn.textContent?.trim().startsWith("#")) {
			decorateTagButton(btn);
		}
	}
	for (const item of document.querySelectorAll<HTMLElement>(".react-aria-ListBoxItem")) {
		if (item.hasAttribute(ATTR)) {
			const textEl = item.querySelector<HTMLElement>("div");
			if (textEl) refreshTagColors(textEl);
		} else if (item.textContent?.trim().startsWith("#")) {
			decorateTagOption(item);
		}
	}
}

let observer: MutationObserver | null = null;

function startObserver() {
	if (observer) return;
	let scheduled = false;
	observer = new MutationObserver(() => {
		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(() => {
				scheduled = false;
				scanTags();
			});
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
	observer?.disconnect();
	observer = null;
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
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	init: async (ctx) => {
		const enabled = Boolean(await getValue(ctx.key, ctx.defaultValue));
		if (!enabled) return;
		applyGlobalCSS(CSS, STORAGE_KEY);
		scanTags();
		startObserver();
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (value) {
			applyGlobalCSS(CSS, STORAGE_KEY);
			scanTags();
			startObserver();
		} else {
			stopObserver();
			cleanup();
			applyGlobalCSS("", STORAGE_KEY);
		}
	},
});
