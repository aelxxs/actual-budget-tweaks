import { applyGlobalCSS, createElement } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

const ICON_PICKER_MODAL_CLASS = "abt-icon-picker-modal";
const ICON_PICKER_TABS_CLASS = "abt-icon-picker-tabs";
const ICON_PICKER_GRID_CLASS = "abt-icon-picker-grid";
const ROOT_TOGGLE_ATTR = "data-abt-account-icons";
const STORAGE_KEY_PREFIX = "abt-account-icons";
const ACCOUNT_NAME_SELECTOR = '[data-testid="account-name"], .css-15e1mkk';
const ACCOUNT_TITLE_SELECTOR = '[data-testid="account-name"].css-1kp6ojj';
const ACCOUNT_ICON_IMG_CLASS = "abt-account-icon-img";
const PICKER_BUTTON_ATTR = "data-abt-picker-button";
const SIDEBAR_ICON_ATTR = "data-abt-sidebar-icon";
const ICON_RENDER_VERSION = "6";
const EMOJI_ASSET_BASE_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

// Common emoji categories
const EMOJI_CATEGORIES = {
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

interface AccountIconData {
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

async function loadIconCache(): Promise<Record<string, AccountIconData>> {
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

function getEmojiAssetUrl(emoji: string): string {
	return `${EMOJI_ASSET_BASE_URL}/${emojiToCodepoint(emoji)}.svg`;
}

function splitEmojiGraphemes(source: string): string[] {
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

function guessBank(accountName: string): string | null {
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

function createEmojiTab(): HTMLElement {
	const tabContent = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-pane`,
	}) as HTMLDivElement;

	const grid = createElement("div", {
		className: ICON_PICKER_GRID_CLASS,
	}) as HTMLDivElement;

	for (const [category, emojis] of Object.entries(EMOJI_CATEGORIES)) {
		const categoryDiv = createElement("div", {
			className: `${ICON_PICKER_GRID_CLASS}-category`,
		}) as HTMLDivElement;

		const categoryTitle = createElement("div", {
			className: `${ICON_PICKER_GRID_CLASS}-category-title`,
			textContent: category,
		}) as HTMLDivElement;

		const categoryEmojis = createElement("div", {
			className: `${ICON_PICKER_GRID_CLASS}-category-emojis`,
		}) as HTMLDivElement;

		for (const emoji of splitEmojiGraphemes(emojis)) {
			const emojiBtn = createElement("button", {
				className: `${ICON_PICKER_GRID_CLASS}-emoji`,
				textContent: emoji,
			}) as HTMLButtonElement;
			emojiBtn.title = emoji;
			emojiBtn.setAttribute("aria-label", emoji);
			emojiBtn.style.position = "relative";

			const emojiImg = createElement("img", {
				src: getEmojiAssetUrl(emoji),
				alt: emoji,
				width: 24,
				height: 24,
				style: {
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: "24px",
					height: "24px",
					objectFit: "contain",
					pointerEvents: "none",
				},
			}) as HTMLImageElement;

			emojiImg.onload = () => {
				emojiBtn.style.color = "transparent";
			};

			emojiImg.onerror = () => {
				emojiImg.remove();
				emojiBtn.style.color = "inherit";
			};

			emojiBtn.appendChild(emojiImg);

			emojiBtn.dataset.emoji = emoji;
			categoryEmojis.appendChild(emojiBtn);
		}

		categoryDiv.appendChild(categoryTitle);
		categoryDiv.appendChild(categoryEmojis);
		grid.appendChild(categoryDiv);
	}

	tabContent.appendChild(grid);
	return tabContent;
}

function createUploadTab(): HTMLElement {
	const tabContent = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-pane`,
	}) as HTMLDivElement;

	const uploadArea = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-upload-area`,
	}) as HTMLDivElement;

	const uploadInput = createElement("input", {
		type: "file",
		accept: "image/*",
	}) as HTMLInputElement;

	uploadInput.style.display = "none";

	const uploadLabel = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-upload-label`,
		textContent: "Drag & drop an image or click to browse",
	}) as HTMLDivElement;

	const preview = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-preview`,
	}) as HTMLDivElement;

	preview.style.display = "none";

	function handleFile(file: File): void {
		if (!file.type.startsWith("image/")) {
			alert("Please select an image file");
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			preview.innerHTML = `<img src="${dataUrl}" alt="preview" style="max-width: 100%; max-height: 200px; border-radius: var(--border-radius);">`;
			preview.style.display = "block";
			uploadArea.dataset.imageData = dataUrl;
		};
		reader.readAsDataURL(file);
	}

	uploadInput.addEventListener("change", (e) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) handleFile(file);
	});

	uploadArea.addEventListener("click", () => {
		uploadInput.click();
	});

	uploadArea.addEventListener("dragover", (e) => {
		e.preventDefault();
		uploadArea.style.borderColor = "var(--color-buttonPrimaryBackground)";
		uploadArea.style.backgroundColor = "var(--color-formInputBackgroundSelected)";
	});

	uploadArea.addEventListener("dragleave", () => {
		uploadArea.style.borderColor = "var(--color-tableBorder)";
		uploadArea.style.backgroundColor = "transparent";
	});

	uploadArea.addEventListener("drop", (e) => {
		e.preventDefault();
		uploadArea.style.borderColor = "var(--color-tableBorder)";
		uploadArea.style.backgroundColor = "transparent";
		const file = e.dataTransfer?.files?.[0];
		if (file) handleFile(file);
	});

	uploadArea.appendChild(uploadLabel);
	uploadArea.appendChild(preview);

	tabContent.appendChild(uploadInput);
	tabContent.appendChild(uploadArea);
	return tabContent;
}

function createAutoTab(accountName: string): HTMLElement {
	const tabContent = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-pane`,
	}) as HTMLDivElement;

	const domain = guessBank(accountName);
	const autoContainer = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-auto-container`,
	}) as HTMLDivElement;

	const domainInput = createElement("input", {
		type: "text",
		placeholder: "e.g., bankofamerica.com",
		style: {
			padding: "0.5rem",
			borderRadius: "var(--border-radius)",
			border: "var(--border)",
			background: "var(--color-formInputBackground)",
			color: "var(--color-formInputText)",
			flex: "1",
			boxSizing: "border-box",
		},
	}) as HTMLInputElement;

	if (domain) {
		domainInput.value = domain;
	}

	const inputGroup = createElement("div", {
		style: {
			display: "flex",
			gap: "0.5rem",
			marginBottom: "1rem",
			width: "100%",
			boxSizing: "border-box",
		},
	}) as HTMLDivElement;

	const preview = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-preview`,
		style: {
			minHeight: "100px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			marginBottom: "1rem",
		},
	}) as HTMLDivElement;

	const selectBtn = createElement("button", {
		textContent: "Use this logo",
		style: {
			padding: "0.5rem 1rem",
			borderRadius: "var(--border-radius)",
			border: "var(--border)",
			background: "var(--color-buttonNormalBackground)",
			color: "var(--color-buttonNormalText)",
			cursor: "pointer",
			display: "none",
			width: "100%",
			marginTop: "1rem",
		},
	}) as HTMLButtonElement;

	const fetchBtn = createElement("button", {
		textContent: "Fetch Logo",
		style: {
			padding: "0.5rem 1rem",
			borderRadius: "var(--border-radius)",
			border: "var(--border)",
			background: "var(--color-buttonPrimaryBackground)",
			color: "var(--color-buttonPrimaryText)",
			cursor: "pointer",
			whiteSpace: "nowrap",
		},
	}) as HTMLButtonElement;

	fetchBtn.addEventListener("click", () => {
		const inputDomain = domainInput.value.trim().toLowerCase();
		if (!inputDomain) {
			preview.innerHTML = '<p style="color: var(--color-formLabelText);">Please enter a domain</p>';
			selectBtn.style.display = "none";
			return;
		}

		const logoUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${inputDomain}&size=128`;
		const img = createElement("img", {
			src: logoUrl,
			alt: "Bank logo",
			style: {
				maxWidth: "100%",
				maxHeight: "120px",
				borderRadius: "8px",
			},
		});

		preview.innerHTML = "";
		preview.appendChild(img);

		img.onerror = () => {
			preview.innerHTML = `<p style="color: var(--color-formLabelText);">Could not load logo for ${inputDomain}</p>`;
			selectBtn.style.display = "none";
		};

		img.onload = () => {
			selectBtn.style.display = "block";
			autoContainer.dataset.selectedUrl = logoUrl;
		};
	});

	// Auto-fetch if domain was detected
	if (domain) {
		const logoUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
		const img = createElement("img", {
			src: logoUrl,
			alt: "Bank logo",
			style: {
				maxWidth: "100%",
				maxHeight: "120px",
				borderRadius: "8px",
			},
			width: 1,
			height: 1,
		});

		preview.appendChild(img);

		img.onerror = () => {
			preview.innerHTML = `<p style="color: var(--color-formLabelText);">Could not load logo for ${domain}</p>`;
			selectBtn.style.display = "none";
		};

		img.onload = () => {
			selectBtn.style.display = "block";
			autoContainer.dataset.selectedUrl = logoUrl;
		};
	} else {
		preview.innerHTML = '<p style="color: var(--color-formLabelText);">Enter a domain to fetch its favicon</p>';
	}

	selectBtn.addEventListener("click", () => {
		autoContainer.dataset.selected = "true";
	});

	inputGroup.appendChild(domainInput);
	inputGroup.appendChild(fetchBtn);

	autoContainer.appendChild(inputGroup);
	autoContainer.appendChild(preview);
	autoContainer.appendChild(selectBtn);

	tabContent.appendChild(autoContainer);
	return tabContent;
}

function createIconPickerModal(accountId: string, accountName: string): HTMLElement {
	const modal = createElement("div", {
		className: ICON_PICKER_MODAL_CLASS,
	}) as HTMLDivElement;

	const backdrop = createElement("div", {
		className: `${ICON_PICKER_MODAL_CLASS}-backdrop`,
	}) as HTMLDivElement;

	backdrop.addEventListener("click", () => {
		modal.remove();
	});

	const content = createElement("div", {
		className: `${ICON_PICKER_MODAL_CLASS}-content`,
	}) as HTMLDivElement;

	const header = createElement("div", {
		className: `${ICON_PICKER_MODAL_CLASS}-header`,
		textContent: `Set icon for ${accountName}`,
	}) as HTMLDivElement;

	const closeButton = createElement("button", {
		className: `${ICON_PICKER_MODAL_CLASS}-close`,
		textContent: "✕",
	}) as HTMLButtonElement;

	closeButton.addEventListener("click", () => {
		modal.remove();
	});

	const saveAndClose = async (iconData: AccountIconData): Promise<void> => {
		await setAccountIcon(accountId, iconData);
		applyAccountIcon(accountId, iconData);
		modal.remove();
	};

	// Create tabs
	const tabsContainer = createElement("div", {
		className: ICON_PICKER_TABS_CLASS,
	}) as HTMLDivElement;

	const tabButtons = createElement("div", {
		className: `${ICON_PICKER_TABS_CLASS}-buttons`,
	}) as HTMLDivElement;

	const autoTab = createAutoTab(accountName);
	const uploadTab = createUploadTab();
	const emojiTab = createEmojiTab();

	const autoBtn = createElement("button", {
		className: `${ICON_PICKER_TABS_CLASS}-button`,
		textContent: "Auto",
	}) as HTMLButtonElement;

	const uploadBtn = createElement("button", {
		className: `${ICON_PICKER_TABS_CLASS}-button`,
		textContent: "Upload",
	}) as HTMLButtonElement;

	const emojiBtn = createElement("button", {
		className: `${ICON_PICKER_TABS_CLASS}-button`,
		textContent: "Emoji",
	}) as HTMLButtonElement;

	const tabs = [
		{ btn: autoBtn, content: autoTab },
		{ btn: uploadBtn, content: uploadTab },
		{ btn: emojiBtn, content: emojiTab },
	];

	function showTab(index: number): void {
		tabs.forEach((tab, i) => {
			tab.btn.classList.toggle(`${ICON_PICKER_TABS_CLASS}-button-active`, i === index);
			tab.content.style.display = i === index ? "block" : "none";
		});
	}

	autoBtn.addEventListener("click", () => showTab(0));
	uploadBtn.addEventListener("click", () => showTab(1));
	emojiBtn.addEventListener("click", () => showTab(2));

	tabButtons.appendChild(autoBtn);
	tabButtons.appendChild(uploadBtn);
	tabButtons.appendChild(emojiBtn);

	// Handle emoji selection
	emojiTab.addEventListener("click", (e) => {
		const btn = e.target as HTMLElement;
		if (btn.dataset.emoji) {
			void saveAndClose({ type: "emoji", value: btn.dataset.emoji });
		}
	});

	// Handle auto selection
	autoTab.addEventListener("click", (e) => {
		const btn = e.target as HTMLButtonElement;
		if (btn.textContent === "Use this logo") {
			const url = (autoTab.querySelector(`.${ICON_PICKER_TABS_CLASS}-auto-container`) as HTMLDivElement)?.dataset
				.selectedUrl;
			if (url) {
				void saveAndClose({ type: "url", value: url });
			}
		}
	});

	// Handle save button for upload
	const saveBtn = createElement("button", {
		className: `${ICON_PICKER_MODAL_CLASS}-save`,
		textContent: "Save",
	}) as HTMLButtonElement;

	saveBtn.addEventListener("click", async () => {
		const uploadArea = uploadTab.querySelector(`.${ICON_PICKER_TABS_CLASS}-upload-area`) as HTMLDivElement;
		const imageData = uploadArea?.dataset.imageData;
		if (imageData) {
			await saveAndClose({ type: "dataUrl", value: imageData });
			return;
		}
		modal.remove();
	});

	const removeBtn = createElement("button", {
		className: `${ICON_PICKER_MODAL_CLASS}-remove`,
		textContent: "Remove icon",
	}) as HTMLButtonElement;

	const syncActionLayout = (hasIcon: boolean): void => {
		removeBtn.style.display = hasIcon ? "block" : "none";
		saveBtn.style.gridColumn = hasIcon ? "" : "1 / -1";
	};

	syncActionLayout(Boolean(iconCache?.[accountId]));
	void loadIconCache()
		.then((icons) => {
			syncActionLayout(Boolean(icons[accountId]));
		})
		.catch(() => undefined);

	removeBtn.addEventListener("click", async () => {
		await removeAccountIcon(accountId);
		clearAccountIcon(accountId);
		modal.remove();
	});

	const actions = createElement("div", {
		className: `${ICON_PICKER_MODAL_CLASS}-actions`,
	}) as HTMLDivElement;
	actions.appendChild(removeBtn);
	actions.appendChild(saveBtn);

	tabsContainer.appendChild(tabButtons);
	tabsContainer.appendChild(autoTab);
	tabsContainer.appendChild(uploadTab);
	tabsContainer.appendChild(emojiTab);
	tabsContainer.appendChild(actions);

	content.appendChild(closeButton);
	content.appendChild(header);
	content.appendChild(tabsContainer);

	modal.appendChild(backdrop);
	modal.appendChild(content);

	showTab(0); // Show auto tab by default
	return modal;
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

			// Mount picker button once as a stable child to avoid reordering account-name DOM.
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
						background: "var(--color-sidebarItemBackgroundHover)",
						color: "var(--color-sidebarItemText)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
						pointerEvents: "auto",
						opacity: "0",
						transition: "none",
						zIndex: "30",
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
					if (document.querySelector(`.${ICON_PICKER_MODAL_CLASS}`)) return;
					const accountName = (nameEl.textContent || nameEl.dataset.abtBaseText || "").trim();
					const modal = createIconPickerModal(accountId, accountName);
					document.body.appendChild(modal);
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
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS} {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: 10000;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-backdrop {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.3);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-content {
				position: relative;
				background: var(--color-modalBackground);
				border: var(--border);
				border-radius: var(--border-radius);
				padding: 1.5rem;
				width: 600px;
				max-height: 80vh;
				overflow-y: auto;
				z-index: 10001;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-close {
				position: absolute;
				top: 0.75rem;
				right: 0.75rem;
				width: 24px;
				height: 24px;
				padding: 0;
				border: 0;
				background: transparent;
				color: var(--color-tooltipText);
				font-size: 18px;
				cursor: pointer;
				z-index: 10002;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-close:hover {
				color: var(--color-buttonNormalText);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-header {
				text-align: center;
				font-weight: bold;
				color: var(--color-tooltipText);
				margin-bottom: 1.5rem;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS} {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-buttons {
				display: flex;
				gap: 0.5rem;
				border-bottom: var(--border);
				padding-bottom: 0.5rem;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-button {
				padding: 0.5rem 1rem;
				border: 0;
				background: transparent;
				color: var(--color-formLabelText);
				cursor: pointer;
				font-size: 14px;
				font-weight: 500;
				border-bottom: 2px solid transparent;
				transition: all 0.2s;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-button:hover {
				color: var(--color-buttonNormalText);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-button-active {
				color: var(--color-buttonPrimaryBackground);
				border-bottom-color: var(--color-buttonPrimaryBackground);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-pane {
				display: none;
				min-height: 200px;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-auto-container {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 1rem;
				min-height: 200px;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-upload-area {
				border: 2px dashed var(--color-tableBorder);
				border-radius: var(--border-radius);
				padding: 2rem;
				text-align: center;
				cursor: pointer;
				transition: all 0.2s;
				background: transparent;
				min-height: 150px;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 1rem;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-upload-area:hover {
				border-color: var(--color-buttonPrimaryBackground);
				background: var(--color-formInputBackgroundSelected);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-upload-label {
				color: var(--color-formLabelText);
				font-size: 14px;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_TABS_CLASS}-preview {
				display: flex;
				justify-content: center;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_GRID_CLASS} {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				max-height: 400px;
				overflow-y: auto;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_GRID_CLASS}-category {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_GRID_CLASS}-category-title {
				font-size: 12px;
				font-weight: bold;
				color: var(--color-formLabelText);
				text-transform: uppercase;
				letter-spacing: 0.05em;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_GRID_CLASS}-category-emojis {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
				gap: 0.5rem;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_GRID_CLASS}-emoji {
				width: 100%;
				aspect-ratio: 1;
				padding: 0;
				border: 1px solid var(--color-tableBorder);
				border-radius: var(--border-radius);
				background: var(--color-tableBackground);
				color: inherit;
				font-size: 20px;
				cursor: pointer;
				transition: all 0.2s;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_GRID_CLASS}-emoji:hover {
				background: var(--color-tableRowBackgroundHover);
				border-color: var(--color-tableBorderHover);
				transform: scale(1.05);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-save {
				width: 100%;
				padding: 0.75rem;
				border: var(--border);
				border-radius: var(--border-radius);
				background: var(--color-buttonPrimaryBackground);
				color: var(--color-buttonPrimaryText);
				font-weight: 500;
				cursor: pointer;
				transition: all 0.2s;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-save:hover {
				background: var(--color-buttonPrimaryBackgroundHover);
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-actions {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 0.75rem;
				margin-top: 1rem;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-remove {
				width: 100%;
				padding: 0.75rem;
				border: var(--border);
				border-radius: var(--border-radius);
				background: var(--color-buttonNormalBackground);
				color: var(--color-buttonNormalText);
				font-weight: 500;
				cursor: pointer;
				transition: all 0.2s;
			}
			:root[${ROOT_TOGGLE_ATTR}="on"] .${ICON_PICKER_MODAL_CLASS}-remove:hover {
				background: var(--color-buttonNormalBackgroundHover);
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
