import { defineSetting } from "@features/types";
import { createElement } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { getValue, setValue } from "@lib/utilities/store";

const ROOT_TOGGLE_ATTR = "data-abt-account-icons";
const STORAGE_KEY_PREFIX = "abt-account-icons";
const ACCOUNT_TITLE_SELECTOR = '[data-testid="account-name"]';
const ACCOUNT_ICON_IMG_CLASS = "abt-account-icon-img";
const ICON_SIZE = 28;
const EMOJI_ASSET_BASE_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

export interface AccountIconData {
	type: "emoji" | "dataUrl" | "url";
	value: string;
}

let iconCache: Record<string, AccountIconData> | null = null;
let iconCachePromise: Promise<Record<string, AccountIconData>> | null = null;
let enabled = false;

export async function loadIconCache(): Promise<Record<string, AccountIconData>> {
	if (iconCache) return iconCache;
	if (iconCachePromise) return iconCachePromise;

	iconCachePromise = (async () => {
		const icons = (await getValue(
			STORAGE_KEY_PREFIX,
			{} as Record<string, AccountIconData>,
		)) as Record<string, AccountIconData>;
		iconCache = icons;
		iconCachePromise = null;
		return icons;
	})().catch((error) => {
		iconCachePromise = null;
		throw error;
	});

	return iconCachePromise;
}

function currentAccountId(): string | null {
	const match = location.pathname.match(/^\/accounts\/([a-f0-9-]+)$/);
	return match && match[1].includes("-") ? match[1] : null;
}

function emojiToCodepoint(emoji: string): string {
	const codepoints = Array.from(emoji)
		.map((char) => char.codePointAt(0)?.toString(16))
		.filter((part): part is string => Boolean(part));

	return codepoints
		.filter((part, index) => {
			if (part !== "fe0f") return true;
			const next = codepoints[index + 1];
			// Keep VS16 when it is semantically important in keycap/ZWJ sequences.
			return next === "200d" || next === "20e3";
		})
		.join("-");
}

export function getEmojiAssetUrl(emoji: string): string {
	return `${EMOJI_ASSET_BASE_URL}/${emojiToCodepoint(emoji)}.svg`;
}

export async function setAccountIcon(accountId: string, iconData: AccountIconData): Promise<void> {
	const icons = await loadIconCache();
	icons[accountId] = iconData;
	await setValue(STORAGE_KEY_PREFIX, icons);
	syncTitle();
}

export async function removeAccountIcon(accountId: string): Promise<void> {
	const icons = await loadIconCache();
	delete icons[accountId];
	await setValue(STORAGE_KEY_PREFIX, icons);
	syncTitle();
}

/** The account page's title; the live sidebar draws its own icons. */
function titleEls(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>(ACCOUNT_TITLE_SELECTOR)].filter(
		(el) => !el.closest("a[href^='/accounts/']"),
	);
}

function clearTitle(el: HTMLElement): void {
	if (el.dataset.abtIconSignature === undefined) return;
	el.textContent = el.dataset.abtBaseText ?? el.textContent ?? "";
	delete el.dataset.abtIconSignature;
	delete el.dataset.abtBaseText;
}

function renderTitle(el: HTMLElement, iconData: AccountIconData): void {
	const signature = `${iconData.type}:${iconData.value}`;
	const current = el.querySelector(`.${ACCOUNT_ICON_IMG_CLASS}`);
	// React re-renders the title text (e.g. after a rename), which drops our markup.
	if (el.dataset.abtIconSignature === signature && current) return;

	const baseText = current
		? (el.dataset.abtBaseText ?? "")
		: (el.textContent ?? "").replace(iconData.value, "").trim();
	el.dataset.abtBaseText = baseText;
	el.dataset.abtIconSignature = signature;

	const icon = createElement("img", {
		className: ACCOUNT_ICON_IMG_CLASS,
		src: iconData.type === "emoji" ? getEmojiAssetUrl(iconData.value) : iconData.value,
		alt: iconData.type === "emoji" ? iconData.value : "Account icon",
		width: ICON_SIZE,
		height: ICON_SIZE,
		style: {
			width: `${ICON_SIZE}px`,
			height: `${ICON_SIZE}px`,
			objectFit: "contain",
			flexShrink: "0",
			marginRight: "0.25em",
			borderRadius: iconData.type === "emoji" ? "0" : "2px",
			pointerEvents: "none",
		},
	}) as HTMLImageElement;
	if (iconData.type === "emoji") {
		icon.onerror = () => {
			const glyph = createElement("span", { className: ACCOUNT_ICON_IMG_CLASS });
			glyph.textContent = iconData.value;
			icon.replaceWith(glyph);
		};
	}
	const text = document.createElement("span");
	text.textContent = baseText;
	el.replaceChildren(icon, text);
}

function syncTitle(): void {
	if (!enabled) return;
	const els = titleEls();
	if (!els.length) return;
	const id = currentAccountId();
	const iconData = id ? iconCache?.[id] : undefined;
	for (const el of els) {
		if (iconData) renderTitle(el, iconData);
		else clearTitle(el);
	}
}

export const accountIconPicker = defineSetting({
	type: "checkbox",
	label: "Account Icon Picker",
	description: "Set a custom favicon or emoji icon per account.",
	group: "Sidebar",
	icon: "image",
	context: {
		key: "account-icon-picker",
		defaultValue: true,
	},
	css: () => `
		:root[${ROOT_TOGGLE_ATTR}="on"] [data-abt-icon-signature] {
			display: flex;
			flex-direction: row;
			align-items: center;
			white-space: nowrap;
		}
	`,
	init: () => {
		enabled = true;
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		void loadIconCache()
			.then(syncTitle)
			.catch(() => undefined);
		const unwatch = watchDom(syncTitle);

		return () => {
			enabled = false;
			unwatch();
			titleEls().forEach(clearTitle);
			document.documentElement.removeAttribute(ROOT_TOGGLE_ATTR);
		};
	},
});
