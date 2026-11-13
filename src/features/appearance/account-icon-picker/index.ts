import { defineSetting } from "@features/types";
import { onListChange, query } from "@lib/utilities/actual-api";
import { createElement } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { getValue, setValue, watchValue } from "@lib/utilities/store";
import {
	ACCOUNT_CELL,
	ACCOUNT_LINK,
	ACCOUNT_NAME,
	MOBILE_ACCOUNT_ROW,
	PREVIEW_ROW,
} from "@lib/actual-dom";

const ROOT_TOGGLE_ATTR = "data-abt-account-icons";
const STORAGE_KEY_PREFIX = "abt-account-icons";
const ACCOUNT_ICON_IMG_CLASS = "abt-account-icon-img";
const ICON_SIZE = 28;
// Mobile's accounts page: each row's name, drawn with its icon through a CSS variable.
const MOBILE_ROW_NAME = `${MOBILE_ACCOUNT_ROW} ${ACCOUNT_NAME}`;
const MOBILE_ICON_ATTR = "data-abt-m-account-icon";
// Transaction tables' Account column, tagged with the id by the bridge.
const ACCOUNT_ID_ATTR = "data-abt-account-id";
const CELL_ICON_CLASS = "abt-account-cell-icon";
const EMOJI_ASSET_BASE_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

export interface AccountIconData {
	type: "emoji" | "dataUrl" | "url";
	value: string;
}

let iconCache: Record<string, AccountIconData> | null = null;
let iconCachePromise: Promise<Record<string, AccountIconData>> | null = null;
let enabled = false;

export async function loadIconCache(): Promise<Record<string, AccountIconData>> {
	if (iconCache) {
		return iconCache;
	}
	if (iconCachePromise) {
		return iconCachePromise;
	}

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

/** Calls `callback` with the whole map whenever it's saved, here or by settings sync. */
export function watchAccountIcons(
	callback: (icons: Record<string, AccountIconData>) => void,
): () => void {
	return watchValue<Record<string, AccountIconData>>(STORAGE_KEY_PREFIX, (icons) => {
		iconCache = icons ?? {};
		callback(iconCache);
	});
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
			if (part !== "fe0f") {
				return true;
			}
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
	return [...document.querySelectorAll<HTMLElement>(ACCOUNT_NAME)].filter(
		(el) => !el.closest(ACCOUNT_LINK),
	);
}

function clearTitle(el: HTMLElement): void {
	if (el.dataset.abtIconSignature === undefined) {
		return;
	}
	el.textContent = el.dataset.abtBaseText ?? el.textContent ?? "";
	delete el.dataset.abtIconSignature;
	delete el.dataset.abtBaseText;
}

const iconUrl = (iconData: AccountIconData) =>
	iconData.type === "emoji" ? getEmojiAssetUrl(iconData.value) : iconData.value;

function renderTitle(el: HTMLElement, iconData: AccountIconData): void {
	const signature = `${iconData.type}:${iconData.value}`;
	const current = el.querySelector(`.${ACCOUNT_ICON_IMG_CLASS}`);
	// React re-renders the title text (e.g. after a rename), which drops our markup.
	if (el.dataset.abtIconSignature === signature && current) {
		return;
	}

	const baseText = current
		? (el.dataset.abtBaseText ?? "")
		: (el.textContent ?? "").replace(iconData.value, "").trim();
	el.dataset.abtBaseText = baseText;
	el.dataset.abtIconSignature = signature;

	const icon = createElement("img", {
		className: ACCOUNT_ICON_IMG_CLASS,
		src: iconUrl(iconData),
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
	if (!enabled) {
		return;
	}
	const els = titleEls();
	if (!els.length) {
		return;
	}
	const id = currentAccountId();
	const iconData = id ? iconCache?.[id] : undefined;
	for (const el of els) {
		if (iconData) {
			renderTitle(el, iconData);
		} else {
			clearTitle(el);
		}
	}
}

function cellIcon(iconData: AccountIconData, url: string): HTMLElement {
	const img = document.createElement("img");
	img.className = CELL_ICON_CLASS;
	img.alt = "";
	img.src = url;
	img.dataset.abtIcon = url;
	if (iconData.type === "emoji") {
		img.onerror = () => {
			const glyph = document.createElement("span");
			glyph.className = CELL_ICON_CLASS;
			glyph.dataset.abtIcon = url;
			glyph.textContent = iconData.value;
			img.replaceWith(glyph);
		};
	}
	return img;
}

function syncCells(): void {
	document.dispatchEvent(new CustomEvent("abt:api:mark-account-ids"));
	for (const cell of document.querySelectorAll(`${ACCOUNT_CELL}[${ACCOUNT_ID_ATTR}]`)) {
		const iconData = iconCache?.[cell.getAttribute(ACCOUNT_ID_ATTR) ?? ""];
		const url = iconData ? iconUrl(iconData) : null;
		const shown = cell.querySelector<HTMLElement>(`.${CELL_ICON_CLASS}`);
		if ((shown?.dataset.abtIcon ?? null) === url) {
			continue;
		}
		shown?.remove();
		if (iconData && url) {
			cell.querySelector(":scope > div > span")?.prepend(cellIcon(iconData, url));
		}
	}
}

/*
 * Mobile rows carry no account id, so names are matched against Actual's accounts. The icon is
 * a ::before, never markup: React owns the name's text.
 */
let accountIds = new Map<string, string>();
// Names already looked up and not found, so a missing one is asked for once, not every frame.
const askedFor = new Set<string>();
let loadingIds = false;

async function loadAccountIds(): Promise<void> {
	loadingIds = true;
	try {
		const accounts = await query<{ id: string; name: string }[]>("accounts", {
			select: ["id", "name"],
		});
		accountIds = new Map(accounts.map((a) => [a.name, a.id]));
	} finally {
		loadingIds = false;
	}
	syncMobileRows();
}

function syncMobileRows(): void {
	const rows = document.querySelectorAll<HTMLElement>(MOBILE_ROW_NAME);
	// A lookup made before the budget opened comes back empty; rows naming unknown accounts
	// trigger another.
	const unknown = [...rows]
		.map((el) => el.textContent?.trim() ?? "")
		.filter((name) => name && !accountIds.has(name) && !askedFor.has(name));
	if (unknown.length && !loadingIds) {
		unknown.forEach((name) => askedFor.add(name));
		void loadAccountIds().catch(() => undefined);
	}
	for (const el of rows) {
		const id = accountIds.get(el.textContent?.trim() ?? "");
		const iconData = id ? iconCache?.[id] : undefined;
		const url = iconData ? iconUrl(iconData) : null;
		const value = url ? `url("${url.replace(/"/g, "%22")}")` : "";
		if (el.style.getPropertyValue("--abt-account-icon") === value) {
			continue;
		}
		if (value) {
			el.style.setProperty("--abt-account-icon", value);
			el.setAttribute(MOBILE_ICON_ATTR, "");
		} else {
			el.style.removeProperty("--abt-account-icon");
			el.removeAttribute(MOBILE_ICON_ATTR);
		}
	}
}

export const accountIconPicker = defineSetting({
	type: "checkbox",
	label: "Account icon picker",
	description: "Adds an emoji or website icon to each account.",
	group: "Sidebar",
	icon: "image",
	platform: "all",
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

		.${CELL_ICON_CLASS} {
			display: inline-block;
			width: 14px;
			height: 14px;
			margin-right: var(--abt-space-2);
			vertical-align: -2px;
			object-fit: contain;
			border-radius: 2px;
			line-height: 14px;
		}

		${PREVIEW_ROW} .${CELL_ICON_CLASS} {
			opacity: 0.6;
		}

		[${MOBILE_ICON_ATTR}]::before {
			content: "";
			display: inline-block;
			width: 22px;
			height: 22px;
			margin-right: var(--abt-space-3);
			vertical-align: -5px;
			background: var(--abt-account-icon) center / contain no-repeat;
			border-radius: var(--abt-radius-sm);
		}
	`,
	init: () => {
		enabled = true;
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		void loadIconCache()
			.then(() => {
				syncTitle();
				syncMobileRows();
				syncCells();
			})
			.catch(() => undefined);
		const unwatch = watchDom(() => {
			syncTitle();
			syncMobileRows();
			syncCells();
		});
		void loadAccountIds().catch(() => undefined);
		const unwatchAccounts = onListChange("accounts", () => {
			askedFor.clear();
			void loadAccountIds().catch(() => undefined);
		});
		const unwatchIcons = watchAccountIcons(() => {
			syncMobileRows();
			syncCells();
		});

		return () => {
			enabled = false;
			unwatch();
			unwatchAccounts();
			unwatchIcons();
			titleEls().forEach(clearTitle);
			for (const el of document.querySelectorAll(`.${CELL_ICON_CLASS}`)) {
				el.remove();
			}
			for (const el of document.querySelectorAll(`[${ACCOUNT_ID_ATTR}]`)) {
				el.removeAttribute(ACCOUNT_ID_ATTR);
			}
			for (const el of document.querySelectorAll<HTMLElement>(`[${MOBILE_ICON_ATTR}]`)) {
				el.style.removeProperty("--abt-account-icon");
				el.removeAttribute(MOBILE_ICON_ATTR);
			}
			document.documentElement.removeAttribute(ROOT_TOGGLE_ATTR);
		};
	},
});
