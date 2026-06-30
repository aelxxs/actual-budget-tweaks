import { defineSetting } from "@features/types";
import { applyGlobalCSS, createElement } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";
import { mount, unmount } from "svelte";
import IconPickerModal from "./Modal.svelte";

const ROOT_TOGGLE_ATTR = "data-abt-account-icons";
const STORAGE_KEY_PREFIX = "abt-account-icons";
const ACCOUNT_NAME_SELECTOR = ':scope > div:last-of-type > div:first-of-type';
const ACCOUNT_TITLE_SELECTOR = '[data-testid="account-name"]';
const ACCOUNT_ICON_IMG_CLASS = "abt-account-icon-img";
const PICKER_BUTTON_ATTR = "data-abt-picker-button";
const SIDEBAR_ICON_ATTR = "data-abt-sidebar-icon";
const ICON_RENDER_VERSION = "6";
const EMOJI_ASSET_BASE_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

export const EMOJI_CATEGORIES = {
	Objects:
		"📱📷📹🎥🎬🎤🎧🎵🎶🎼🎹🎸🎺🎷🥁📻📺📡💿📀💾💽💻⌨️🖥️🖨️🖱️🖲️🕹️🗜️⚙️🔧🔨⚒️🛠️⛏️🔩⚙️🗝️🔐🔑🚪🛏️🛋️🪑🚽🚿🛁🛒🚬⚰️⚱️🏺🔮🔭🔬",
	Nature: "🌹🥀🌺🌻🌼🌷⛅🌤️⛈️🌩️🌨️❄️☃️⛄🌬️💨💧💦☔☂️🌊🌋⛰️🏔️🗻🏕️⛺🏠🏡🏘️🏚️🏗️🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛️⛪🕌🕍🛕",
	Food: "🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶️🌽🥕🧄🧅🥔🍠🥐🥯🍞🤞🥖🥨🧀🥚🍳🧈🥞🧇🥓🥞🍗🍖🌭🍔🍟🍕",
	Animals: "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🪱🐛🦋🐌🐞🐜",
	Activities: "⚽🏀🏈⚾🥎🎾🏐🏉🥏🎳🏓🏸🏒🏑🥍🏘️🥅⛳⛸️🎣🎽🎿🛷🥌🎯🪀",
	Travel: "🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🛻🚚🚛🚜🏍️🏎️🛵🦯🦽🦼🛺🚲🛴🛹🛼🚏🛣️🛤️🛢️⛽🚨🚥🚦🛑🚧⚓⛵🛶🚤🛳️⛴️🛥️🚢✈️🛩️🛫🛬🛰️",
	Symbols: "❤️🧡💛💚💙💜🖤🤍🤎💔❤️‍🔥💕💞💓💗💖💘💝💟👋🤚🖐️✋🖖👌🤌🤏✌️🤞🫰🤟🤘🤙",
	Smileys: "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙🥲😋😛😜🤪😝🤑",
};

export interface AccountIconData {
	type: "emoji" | "dataUrl" | "url";
	value: string;
}

let observer: MutationObserver | null = null;
let scheduled = false;
let suppressObserver = false;
let iconCache: Record<string, AccountIconData> | null = null;
let iconCachePromise: Promise<Record<string, AccountIconData>> | null = null;
let routeEventsBound = false;
let historyPatched = false;

export async function loadIconCache(): Promise<Record<string, AccountIconData>> {
	if (iconCache) return iconCache;
	if (iconCachePromise) return iconCachePromise;

	iconCachePromise = (async () => {
		const icons = (await getValue(STORAGE_KEY_PREFIX, {} as Record<string, AccountIconData>)) as Record<
			string,
			AccountIconData
		>;
		iconCache = icons;
		iconCachePromise = null;
		return icons;
	})().catch((error) => {
		iconCachePromise = null;
		throw error;
	});

	return iconCachePromise;
}

function isValidAccountId(href: string): boolean {
	const match = href.match(/\/accounts\/([a-f0-9\-]+)$/);
	return match !== null && match[1].includes("-");
}

function getAccountIdFromHref(href: string): string | null {
	const match = href.match(/\/accounts\/([a-f0-9\-]+)$/);
	return match ? match[1] : null;
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

export function splitEmojiGraphemes(source: string): string[] {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
		return Array.from(segmenter.segment(source), ({ segment }) => segment);
	}

	return Array.from(source);
}

async function setAccountIcon(accountId: string, iconData: AccountIconData): Promise<void> {
	const icons = await loadIconCache();
	icons[accountId] = iconData;
	await setValue(STORAGE_KEY_PREFIX, icons);
}

async function removeAccountIcon(accountId: string): Promise<void> {
	const icons = await loadIconCache();
	delete icons[accountId];
	await setValue(STORAGE_KEY_PREFIX, icons);
}

export function guessBank(accountName: string): string | null {
	const nameUpper = accountName.toUpperCase();
	const bankMap: Record<string, string> = {
		BOFA: "bankofamerica.com",
		"BANK OF AMERICA": "bankofamerica.com",
		CHASE: "chase.com",
		JPM: "chase.com",
		"WELLS FARGO": "wellsfargo.com",
		WF: "wellsfargo.com",
		CITI: "citi.com",
		"CAPITAL ONE": "capitalone.com",
		AMEX: "americanexpress.com",
		DISCOVER: "discover.com",
		SOFI: "sofi.com",
		STRIPE: "stripe.com",
		SQUARE: "squareup.com",
		PAYPAL: "paypal.com",
		FIDELITY: "fidelity.com",
		VANGUARD: "vanguard.com",
		"CHARLES SCHWAB": "schwab.com",
		"INTERACTIVE BROKERS": "interactivebrokers.com",
	};

	for (const [key, domain] of Object.entries(bankMap)) {
		if (nameUpper.includes(key)) {
			return domain;
		}
	}

	return null;
}

function clearAccountIcon(accountId: string): void {
	const clearSidebarIcon = (nameEl: HTMLElement): void => {
		const link = nameEl.closest("a[href^='/accounts/']") as HTMLAnchorElement | null;
		const sidebarIcon = link?.querySelector(`[${SIDEBAR_ICON_ATTR}='1']`) as HTMLElement | null;
		sidebarIcon?.remove();
	};

	const clearTitleIcon = (nameEl: HTMLElement): void => {
		const baseText = nameEl.dataset.abtBaseText ?? nameEl.textContent ?? "";
		nameEl.textContent = baseText;
		delete nameEl.dataset.abtIconSignature;
		delete nameEl.dataset.abtAccountId;
	};

	const links = document.querySelectorAll<HTMLAnchorElement>(`a[href="/accounts/${accountId}"]`);
	for (const link of links) {
		const nameEl = link.querySelector(ACCOUNT_NAME_SELECTOR) as HTMLElement | null;
		if (!nameEl) continue;
		clearSidebarIcon(nameEl);
	}

	const currentAccountId = getAccountIdFromHref(window.location.pathname);
	if (currentAccountId !== accountId) return;

	const titleEls = document.querySelectorAll<HTMLElement>(ACCOUNT_TITLE_SELECTOR);
	for (const titleEl of titleEls) {
		if (titleEl.closest("a[href^='/accounts/']")) continue;
		clearTitleIcon(titleEl);
	}
}

function applyAccountIcon(accountId: string, iconData: AccountIconData): void {
	const renderSidebarIcon = (link: HTMLAnchorElement, nameEl: HTMLElement): void => {
		nameEl.style.pointerEvents = "";

		let iconHost = link.querySelector(`[${SIDEBAR_ICON_ATTR}='1']`) as HTMLSpanElement | null;
		if (!iconHost) {
			const nameParent = nameEl.parentElement;
			if (!nameParent) return;

			iconHost = createElement("span", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: "14px",
					height: "14px",
					marginRight: "0.25em",
					flexShrink: "0",
					pointerEvents: "none",
				},
			}) as HTMLSpanElement;
			iconHost.setAttribute(SIDEBAR_ICON_ATTR, "1");
			nameParent.insertBefore(iconHost, nameEl);
		}

		const iconSignature = `${ICON_RENDER_VERSION}:sidebar:${iconData.type}:${iconData.value}`;
		if (iconHost.dataset.abtIconSignature === iconSignature && iconHost.dataset.abtAccountId === accountId) return;

		iconHost.innerHTML = "";
		if (iconData.type === "emoji") {
			const emojiAssetUrl = getEmojiAssetUrl(iconData.value);
			const img = createElement("img", {
				className: ACCOUNT_ICON_IMG_CLASS,
				src: emojiAssetUrl,
				alt: iconData.value,
				width: 14,
				height: 14,
				style: {
					width: "14px",
					height: "14px",
					objectFit: "contain",
					display: "block",
					pointerEvents: "none",
				},
			}) as HTMLImageElement;
			img.onerror = () => {
				iconHost!.textContent = iconData.value;
				iconHost!.style.fontSize = "12px";
				iconHost!.style.lineHeight = "1";
			};
			iconHost.appendChild(img);
		} else {
			const img = createElement("img", {
				className: ACCOUNT_ICON_IMG_CLASS,
				src: iconData.value,
				alt: "Account icon",
				width: 14,
				height: 14,
				style: {
					width: "14px",
					height: "14px",
					objectFit: "contain",
					display: "block",
					borderRadius: "2px",
					pointerEvents: "none",
				},
			});
			iconHost.appendChild(img);
		}

		iconHost.dataset.abtIconSignature = iconSignature;
		iconHost.dataset.abtAccountId = accountId;
	};

	const renderIcon = (nameEl: HTMLElement, variant: "sidebar" | "title"): void => {
		const emojiAssetUrl = iconData.type === "emoji" ? getEmojiAssetUrl(iconData.value) : "";

		const getVisibleBaseText = (): string => {
			const rawText = (nameEl.textContent || "").trim();
			if (!rawText) return rawText;

			if (iconData.type === "emoji") {
				const prefix = `${iconData.value} `;
				if (rawText.startsWith(prefix)) {
					return rawText.slice(prefix.length).trimStart();
				}
			}

			return rawText;
		};

		const hasExpectedMarkup = (baseText: string): boolean => {
			if (iconData.type === "emoji") {
				const img = nameEl.querySelector(`img.${ACCOUNT_ICON_IMG_CLASS}`) as HTMLImageElement | null;
				const span = nameEl.querySelector("span");
				return (
					!!img &&
					!!span &&
					img.getAttribute("src") === emojiAssetUrl &&
					img.dataset.abtEmoji === iconData.value &&
					span.textContent === baseText
				);
			}

			const img = nameEl.querySelector(`img.${ACCOUNT_ICON_IMG_CLASS}`) as HTMLImageElement | null;
			const span = nameEl.querySelector("span");
			return !!img && !!span && img.getAttribute("src") === iconData.value && span.textContent === baseText;
		};

		const hasOurImg = Boolean(nameEl.querySelector(`img.${ACCOUNT_ICON_IMG_CLASS}`));
		const visibleBaseText = getVisibleBaseText();
		if (!hasOurImg && visibleBaseText && visibleBaseText !== nameEl.dataset.abtBaseText) {
			nameEl.dataset.abtBaseText = visibleBaseText;
			delete nameEl.dataset.abtIconSignature;
		}

		if (nameEl.dataset.abtAccountId !== accountId) {
			if (visibleBaseText) {
				nameEl.dataset.abtBaseText = visibleBaseText;
			}
			delete nameEl.dataset.abtIconSignature;
		}

		const iconSignature = `${ICON_RENDER_VERSION}:${variant}:${iconData.type}:${iconData.value}`;
		if (!nameEl.dataset.abtBaseText) {
			nameEl.dataset.abtBaseText = nameEl.textContent || "";
		}
		const baseText = nameEl.dataset.abtBaseText;

		if (nameEl.dataset.abtIconSignature === iconSignature && hasExpectedMarkup(baseText)) return;

		// Apply final layout styles before mutating children to avoid one-frame baseline shifts.
		nameEl.style.display = "flex";
		nameEl.style.alignItems = "center";
		nameEl.style.whiteSpace = "nowrap";
		nameEl.style.flexDirection = "row";
		nameEl.style.pointerEvents = "";

		// Clear existing icon
		nameEl.innerHTML = "";

		if (iconData.type === "emoji") {
			const iconSize = variant === "sidebar" ? 14 : 28;
			const img = createElement("img", {
				className: ACCOUNT_ICON_IMG_CLASS,
				src: emojiAssetUrl,
				alt: iconData.value,
				width: iconSize,
				height: iconSize,
				style: {
					width: `${iconSize}px`,
					height: `${iconSize}px`,
					objectFit: "contain",
					display: "inline-block",
					flexShrink: "0",
					marginRight: "0.25em",
					verticalAlign: "middle",
					pointerEvents: "none",
				},
			}) as HTMLImageElement;
			img.dataset.abtEmoji = iconData.value;

			img.onerror = () => {
				nameEl.textContent = `${iconData.value} ${baseText}`;
				nameEl.dataset.abtIconSignature = iconSignature;
				nameEl.dataset.abtAccountId = accountId;
			};

			const span = document.createElement("span");
			span.textContent = baseText;
			span.style.pointerEvents = "none";

			nameEl.appendChild(img);
			nameEl.appendChild(span);
			nameEl.dataset.abtIconSignature = iconSignature;
			nameEl.dataset.abtAccountId = accountId;
		} else {
			const iconSize = variant === "sidebar" ? 14 : 28;
			const img = createElement("img", {
				className: ACCOUNT_ICON_IMG_CLASS,
				src: iconData.value,
				alt: "Account icon",
				width: iconSize,
				height: iconSize,
				style: {
					width: `${iconSize}px`,
					height: `${iconSize}px`,
					objectFit: "contain",
					display: "inline-block",
					flexShrink: "0",
					marginRight: "0.25em",
					verticalAlign: "middle",
					borderRadius: "2px",
					pointerEvents: "none",
				},
			});

			const span = document.createElement("span");
			span.textContent = baseText;
			span.style.pointerEvents = "none";

			nameEl.appendChild(img);
			nameEl.appendChild(span);
			nameEl.dataset.abtIconSignature = iconSignature;
			nameEl.dataset.abtAccountId = accountId;
		}
	};

	const links = document.querySelectorAll<HTMLAnchorElement>(`a[href="/accounts/${accountId}"]`);
	for (const link of links) {
		const nameEl = link.querySelector(ACCOUNT_NAME_SELECTOR) as HTMLElement | null;
		if (!nameEl) continue;
		renderSidebarIcon(link, nameEl);
	}

	const currentAccountId = getAccountIdFromHref(window.location.pathname);
	if (currentAccountId !== accountId) return;

	const titleEls = document.querySelectorAll<HTMLElement>(ACCOUNT_TITLE_SELECTOR);
	for (const titleEl of titleEls) {
		if (titleEl.closest("a[href^='/accounts/']")) continue;
		renderIcon(titleEl, "title");
	}
}

const DOT_PICKER_ATTR = "data-abt-dot-picker";

function openIconPickerForAccount(accountId: string, accountName: string, anchor: HTMLElement): void {
	if (document.querySelector('[data-abt-modal="icon-picker"]')) return;

	const container = document.createElement("div");
	container.dataset.abtModal = "icon-picker";

	let done = false;
	const cleanup = (): void => {
		if (done) return;
		done = true;
		unmount(instance);
		container.remove();
	};

	const instance = mount(IconPickerModal, {
		target: container,
		props: {
			accountId,
			accountName,
			hasIcon: Boolean(iconCache?.[accountId]),
			anchorRect: anchor.getBoundingClientRect(),
			onSave: async (iconData: AccountIconData) => {
				await setAccountIcon(accountId, iconData);
				applyAccountIcon(accountId, iconData);
				cleanup();
			},
			onRemove: async () => {
				await removeAccountIcon(accountId);
				clearAccountIcon(accountId);
				cleanup();
			},
			onClose: cleanup,
		},
	});

	document.body.appendChild(container);
}

function attachIconPickers(): void {
	const links = document.querySelectorAll<HTMLAnchorElement>("a[href^='/accounts/']");
	suppressObserver = true;
	try {
		const currentAccountId = getAccountIdFromHref(window.location.pathname);
		if (currentAccountId) {
			const currentIcon = iconCache?.[currentAccountId];
			if (currentIcon) {
				applyAccountIcon(currentAccountId, currentIcon);
			}
		}

		for (const link of links) {
			const href = link.getAttribute("href");
			if (!href || !isValidAccountId(href)) continue;

			const accountId = getAccountIdFromHref(href);
			if (!accountId) continue;

			const nameEl = link.querySelector(ACCOUNT_NAME_SELECTOR) as HTMLElement | null;
			if (!nameEl) continue;

			if (!iconCache && !iconCachePromise) {
				void loadIconCache()
					.then(() => scheduleAttachPickers())
					.catch(() => undefined);
			}

			const cachedIcon = iconCache?.[accountId];
			if (cachedIcon) {
				applyAccountIcon(accountId, cachedIcon);
			}

			// Find the dot container (first child div containing .dot)
			const dotContainer = link.querySelector("div:has(> .dot)") as HTMLElement | null;
			if (!dotContainer || dotContainer.hasAttribute(DOT_PICKER_ATTR)) continue;

			// Mount picker button once
			let pickerBtn = link.querySelector(`button[${PICKER_BUTTON_ATTR}="1"]`) as HTMLButtonElement | null;
			if (!pickerBtn) {
				pickerBtn = createElement("button", {
					title: "Change account icon",
					style: {
						position: "absolute",
						left: "2px",
						top: "50%",
						transform: "translateY(-50%)",
						width: "20px",
						height: "20px",
						padding: "0",
						border: "0",
						background: "var(--color-sidebarBackground, transparent)",
						color: "var(--color-sidebarItemText)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
						pointerEvents: "auto",
						opacity: "0",
						transition: "none",
						zIndex: "30",
						borderRadius: "4px",
					},
				}) as HTMLButtonElement;
				const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				iconSvg.setAttribute("viewBox", "0 0 16 16");
				iconSvg.setAttribute("width", "14");
				iconSvg.setAttribute("height", "14");
				iconSvg.setAttribute("aria-hidden", "true");
				iconSvg.style.display = "block";
				iconSvg.style.pointerEvents = "none";

				const iconPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
				iconPath.setAttribute(
					"d",
					"M2.5 11.6 2.9 9l6.6-6.6a1.3 1.3 0 0 1 1.8 0l1.3 1.3a1.3 1.3 0 0 1 0 1.8L6 12.1l-2.6.4Zm1.8-1.6 1 .9 6.2-6.2-1-1L4.3 10Z",
				);
				iconPath.setAttribute("fill", "currentColor");

				iconSvg.appendChild(iconPath);
				pickerBtn.appendChild(iconSvg);
				pickerBtn.setAttribute(PICKER_BUTTON_ATTR, "1");

				pickerBtn.type = "button";
				if (!link.style.position) {
					link.style.position = "relative";
				}
				const blockLinkNavigation = (e: Event): void => {
					e.preventDefault();
					e.stopPropagation();
				};
				link.addEventListener("mouseenter", () => {
					if (!pickerBtn) return;
					pickerBtn.style.transition = "opacity 0.15s";
					pickerBtn.style.opacity = "1";
				});
				link.addEventListener("mouseleave", () => {
					if (!pickerBtn) return;
					pickerBtn.style.transition = "none";
					pickerBtn.style.opacity = "0";
				});
				pickerBtn.addEventListener("pointerdown", blockLinkNavigation);
				pickerBtn.addEventListener("mousedown", blockLinkNavigation);
				pickerBtn.addEventListener("touchstart", blockLinkNavigation, { passive: false });
				pickerBtn.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					const accountName = (nameEl.textContent || nameEl.dataset.abtBaseText || "").trim();
					openIconPickerForAccount(accountId, accountName, pickerBtn!);
				});

				link.appendChild(pickerBtn);
			}
		}
	} finally {
		suppressObserver = false;
	}
}

function scheduleAttachPickers(): void {
	if (scheduled) return;
	scheduled = true;
	requestAnimationFrame(() => {
		scheduled = false;
		attachIconPickers();
	});
}

function startObserving(): void {
	if (observer) observer.disconnect();
	void loadIconCache()
		.then(() => scheduleAttachPickers())
		.catch(() => undefined);
	observer = new MutationObserver(() => {
		if (suppressObserver) return;
		scheduleAttachPickers();
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
	scheduleAttachPickers();
}

function stopObserving(): void {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
}

function bindRouteEvents(): void {
	if (routeEventsBound) return;
	routeEventsBound = true;
	window.addEventListener("popstate", scheduleAttachPickers);
	window.addEventListener("hashchange", scheduleAttachPickers);

	if (historyPatched) return;
	historyPatched = true;

	const originalPushState = history.pushState.bind(history);
	history.pushState = (...args) => {
		const result = originalPushState(...args);
		scheduleAttachPickers();
		return result;
	};

	const originalReplaceState = history.replaceState.bind(history);
	history.replaceState = (...args) => {
		const result = originalReplaceState(...args);
		scheduleAttachPickers();
		return result;
	};
}

export const accountIconPicker = defineSetting({
	type: "checkbox",
	label: "Account Icon Picker",
	context: {
		key: "account-icon-picker",
		defaultValue: true,
		css: `
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-abt-icon-signature] {
				display: flex;
				align-items: center;
				white-space: nowrap;
				flex-direction: row;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] [data-abt-icon-signature] > img {
				display: block;
			}
		`,
	},
	init: async (ctx) => {
		stopObserving();
		applyGlobalCSS("", ctx.key);
		document.documentElement.removeAttribute(ROOT_TOGGLE_ATTR);

		const enabled = Boolean(await getValue(ctx.key, ctx.defaultValue));
		if (!enabled) return;

		applyGlobalCSS(ctx.css, ctx.key);
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		bindRouteEvents();
		startObserving();
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (!value) {
			stopObserving();
			document.documentElement.removeAttribute(ROOT_TOGGLE_ATTR);
			applyGlobalCSS("", ctx.key);
			return;
		}

		applyGlobalCSS(ctx.css, ctx.key);
		document.documentElement.setAttribute(ROOT_TOGGLE_ATTR, "on");
		bindRouteEvents();
		startObserving();
	},
});
