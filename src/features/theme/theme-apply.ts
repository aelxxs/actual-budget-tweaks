import { ACCOUNTS_LINKS, BANK_SYNC_PROVIDER, BUDGET_LINK } from "@lib/actual-dom";
import { getTheme, themes } from "@lib/design";
import { THEME_APPLIED_EVENT } from "@lib/theme-events";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { watchElement } from "@lib/utilities/dom-watcher";
import { editorState } from "./editor-state.svelte";
import { effectsFor, loadThemeEffects, NO_EFFECTS } from "./effects-store.svelte";
import { STUDIO_STYLE_ID, studioCSS, themeEffectsCSS } from "./studio/effects";
import { hexToOklch, type Mode, oklchToHex } from "./studio/generator";
import { isUserTheme, userThemeState } from "./user-themes.svelte";

export type RemoteTheme = {
	name: string;
	repo: string;
	colors: string[];
	mode: "light" | "dark";
};

export const TOKENS_STYLE_ID = "color-tokens";
export const NATIVE_THEME_KEY = "native";

const originalRootProperties = new Map<string, { value: string; priority: string }>();

/**
 * Theme Studio's own border color: a palette without one falls back to surface0, so one left on
 * the page by an earlier Studio theme is cleared first.
 */
function clearStudioLine(root: HTMLElement, keys: Record<string, string>) {
	if (!("--ctp-line" in keys)) {
		root.style.removeProperty("--ctp-line");
	}
}

const CHART_KEYS = [
	"teal",
	"yellow",
	"peach",
	"red",
	"blue",
	"pink",
	"green",
	"mauve",
	"rosewater",
];

/**
 * Lifts soft pastels for charts only (chroma toward a 0.17 floor), resolved to hex because
 * Actual's donut chart parses only hex when shading categories and greys out anything else.
 */
function chartCSS(keys: Record<string, string>): string {
	const lines = CHART_KEYS.flatMap((name, i) => {
		const hex = keys[`--ctp-${name}`];
		if (!/^#[\da-f]{6}$/i.test(hex ?? "")) {
			return [];
		}
		const { L, C, h } = hexToOklch(hex);
		return [
			`--color-chartQual${i + 1}: ${oklchToHex(L, Math.max(C, Math.min(C * 1.5, 0.17)), h)};`,
		];
	});
	return lines.length ? `:root {\n\t${lines.join("\n\t")}\n}\n` : "";
}

export function setRootProperty(root: HTMLElement, name: string, value: string) {
	if (!originalRootProperties.has(name)) {
		originalRootProperties.set(name, {
			value: root.style.getPropertyValue(name),
			priority: root.style.getPropertyPriority(name),
		});
	}
	root.style.setProperty(name, value);
}

export const BUILTIN_CSS = `:root {
	/* Theme Studio's borders: tables and controls take its border color in full; containers and
	   dividers (menus, modals, panels) a step below. Without one, both are surface0. */
	--abt-line-secondary: color-mix(in oklab, var(--ctp-line, var(--ctp-surface0)) 50%, var(--ctp-surface0));
	/* Budget */
	--color-budgetCurrentMonth: var(--ctp-mantle);
	--color-budgetHeaderCurrentMonth: color-mix(in srgb, var(--ctp-mantle), var(--ctp-surface0) 30%);
	--color-budgetHeaderOtherMonth: color-mix(in srgb, var(--ctp-mantle), var(--ctp-surface0) 30%);
	--color-budgetOtherMonth: color-mix(in srgb, var(--ctp-crust), var(--ctp-mantle) 40%);
	--color-budgetNumberNegative: var(--ctp-red);
	--color-budgetNumberNeutral: var(--ctp-overlay1);
	--color-budgetNumberPositive: var(--ctp-green);
	--color-budgetNumberZero: var(--ctp-subtext0);

	/* Button – bare */
	--color-buttonBareBackground: transparent;
	--color-buttonBareBackgroundActive: rgba(205, 214, 244, 0.1);
	--color-buttonBareBackgroundHover: var(--ctp-surface0);
	--color-buttonBareDisabledBackground: transparent;
	--color-buttonBareDisabledText: var(--ctp-overlay1);
	--color-buttonBareText: var(--ctp-subtext1);
	--color-buttonBareTextHover: var(--ctp-text);

	/* Button – menu */
	--color-buttonMenuBackground: transparent;
	--color-buttonMenuBackgroundHover: rgba(205, 214, 244, 0.07);
	--color-buttonMenuBorder: var(--ctp-line, var(--ctp-surface0));
	--color-buttonMenuSelectedBackground: var(--ctp-yellow);
	--color-buttonMenuSelectedBackgroundHover: var(--ctp-peach);
	--color-buttonMenuSelectedBorder: var(--ctp-yellow);
	--color-buttonMenuSelectedText: var(--ctp-crust);
	--color-buttonMenuSelectedTextHover: var(--ctp-base);
	--color-buttonMenuText: var(--ctp-subtext0);
	--color-buttonMenuTextHover: var(--ctp-text);

	/* Button – normal */
	--color-buttonNormalBackground: var(--ctp-mantle);
	--color-buttonNormalBackgroundHover: var(--ctp-crust);
	--color-buttonNormalBorder: var(--ctp-line, var(--ctp-surface0));
	--color-buttonNormalDisabledBackground: var(--ctp-surface0);
	--color-buttonNormalDisabledBorder: var(--ctp-surface2);
	--color-buttonNormalDisabledText: var(--ctp-overlay0);
	--color-buttonNormalSelectedBackground: var(--ctp-mauve);
	--color-buttonNormalSelectedText: var(--ctp-base);
	--color-buttonNormalShadow: rgba(0, 0, 0, 0.4);
	--color-buttonNormalText: var(--ctp-text);
	--color-buttonNormalTextHover: var(--ctp-subtext1);

	/* Button – primary */
	--color-buttonPrimaryBackground: var(--ctp-lavender);
	--color-buttonPrimaryBackgroundHover: var(--ctp-mauve);
	--color-buttonPrimaryBorder: var(--ctp-lavender);
	--color-buttonPrimaryDisabledBackground: var(--ctp-surface1);
	--color-buttonPrimaryDisabledBorder: var(--ctp-surface2);
	--color-buttonPrimaryDisabledText: var(--ctp-overlay0);
	--color-buttonPrimaryShadow: rgba(0, 0, 0, 0.6);
	--color-buttonPrimaryText: var(--ctp-crust);
	--color-buttonPrimaryTextHover: var(--ctp-base);

	/* Calendar */
	--color-calendarBackground: var(--ctp-base);
	--color-calendarCellBackground: var(--ctp-mantle);
	--color-calendarItemBackground: var(--ctp-surface0);
	--color-calendarItemText: var(--ctp-text);
	--color-calendarSelectedBackground: var(--ctp-blue);
	--color-calendarText: var(--ctp-text);
	--color-datePickerRangeBackground: color-mix(in srgb, var(--ctp-blue) 25%, var(--ctp-base));

	/* Card */
	--color-cardBackground: var(--ctp-mantle);
	--color-cardBorder: var(--ctp-lavender);
	--color-cardShadow: var(--ctp-crust);

	/* Checkbox */
	--color-checkboxBackgroundSelected: var(--ctp-green);
	--color-checkboxBorderSelected: var(--ctp-green);
	--color-checkboxShadowSelected: transparent;
	--color-checkboxText: var(--ctp-crust);
	--color-checkboxToggleBackground: var(--ctp-surface0);
	--color-checkboxToggleBackgroundSelected: var(--ctp-green);
	--color-checkboxToggleDisabled: var(--ctp-overlay0);

	/* Error */
	--color-errorBackground: color-mix(in srgb, var(--ctp-red) 16%, var(--ctp-base));
	--color-errorBorder: var(--ctp-maroon);
	--color-errorText: var(--ctp-red);
	--color-errorTextDark: var(--ctp-flamingo);
	--color-errorTextDarker: var(--ctp-red);
	--color-errorTextMenu: var(--ctp-rosewater);

	/* Floating action bar */
	--color-floatingActionBarBackground: var(--ctp-mauve);
	--color-floatingActionBarBorder: var(--ctp-mauve);
	--color-floatingActionBarText: var(--ctp-base);

	/* Form input */
	--color-formInputBackground: var(--ctp-surface0);
	--color-formInputBackgroundSelected: var(--ctp-surface1);
	--color-formInputBackgroundSelection: var(--ctp-blue);
	--color-formInputBorder: var(--ctp-line, var(--ctp-surface0));
	--color-formInputBorderSelected: var(--ctp-blue);
	--color-formInputShadowSelected: transparent;
	--color-formInputText: var(--ctp-text);
	--color-formInputTextHighlight: var(--ctp-mauve);
	--color-formInputTextPlaceholder: var(--ctp-overlay0);
	--color-formInputTextPlaceholderSelected: var(--ctp-subtext1);
	--color-formInputTextReadOnlySelection: var(--ctp-surface1);
	--color-formInputTextSelected: var(--ctp-crust);
	--color-formInputTextSelection: var(--ctp-surface0);

	/* Form label */
	--color-formLabelBackground: var(--ctp-surface2);
	--color-formLabelText: var(--ctp-lavender);

	/* Markdown */
	--color-markdownDark: var(--ctp-mauve);
	--color-markdownLight: var(--ctp-lavender);
	--color-markdownNormal: var(--ctp-text);

	/* Menus & autocomplete */
	--color-menuAutoCompleteBackground: var(--ctp-base);
	--color-menuAutoCompleteBackgroundHover: var(--ctp-surface1);
	--color-menuAutoCompleteItemText: var(--ctp-text);
	--color-menuAutoCompleteItemTextHover: var(--ctp-text);
	--color-menuAutoCompleteText: var(--ctp-subtext0);
	--color-menuAutoCompleteTextHeader: var(--ctp-blue);
	--color-menuAutoCompleteTextHover: var(--ctp-blue);

	--color-menuBackground: var(--ctp-mantle);
	--color-menuBorder: var(--abt-line-secondary);
	--color-menuBorderHover: var(--ctp-blue);
	--color-menuItemBackground: var(--ctp-surface0);
	--color-menuItemBackgroundHover: var(--ctp-base);
	--color-menuItemText: var(--ctp-subtext1);
	--color-menuItemTextHeader: var(--ctp-blue);
	--color-menuItemTextHover: var(--ctp-text);
	--color-menuItemTextSelected: var(--ctp-blue);
	--color-menuKeybindingText: var(--ctp-lavender);

	/* Mobile */
	--color-mobileAccountShadow: var(--ctp-crust);
	--color-mobileAccountText: var(--ctp-blue);
	--color-mobileConfigServerViewTheme: var(--ctp-mauve);
	--color-mobileHeaderBackground: var(--ctp-crust);
	--color-mobileHeaderText: var(--ctp-lavender);
	--color-mobileHeaderTextHover: rgba(205, 214, 244, 0.07);
	--color-mobileHeaderTextSubdued: var(--ctp-subtext0);
	--color-mobileNavBackground: var(--ctp-mantle);
	--color-mobileNavItem: var(--ctp-text);
	--color-mobileNavItemSelected: var(--ctp-lavender);
	--color-mobilePageBackground: var(--ctp-crust);
	--color-mobileTransactionSelected: var(--ctp-lavender);
	--color-mobileViewTheme: var(--ctp-crust);

	--color-modalBackground: var(--ctp-mantle);
	--color-modalBorder: var(--abt-line-secondary);

	/* Notes */
	--color-noteTagBackground: var(--ctp-mauve);
	--color-noteTagBackgroundHover: var(--ctp-pink);
	--color-noteTagDefault: var(--ctp-mauve);
	--color-noteTagText: var(--ctp-crust);

	/* Notices */
	--color-noticeBackground: var(--ctp-teal);
	--color-noticeBackgroundDark: var(--ctp-teal);
	--color-noticeBackgroundLight: color-mix(in srgb, var(--ctp-green) 16%, var(--ctp-base));
	--color-noticeBorder: var(--ctp-green);
	/* Actual mostly sets plain green text with this; solid notice pills use noticeTextDark. */
	--color-noticeText: var(--ctp-green);
	--color-noticeTextDark: var(--ctp-base);
	--color-noticeTextLight: var(--ctp-green);
	--color-noticeTextMenu: var(--ctp-teal);
	--color-noticeTextMenuHover: var(--ctp-green);

	/* Numbers */
	--color-numberNegative: var(--ctp-red);
	--color-numberNeutral: var(--ctp-overlay1);
	--color-numberPositive: var(--ctp-green);

	/* Overlay */
	--color-overlayBackground: rgba(0, 0, 0, 0.3);

	/* Page */
	--color-pageBackground: var(--ctp-crust);
	--color-pageBackgroundBottomRight: var(--ctp-surface0);
	--color-pageBackgroundLineBottom: var(--ctp-text);
	--color-pageBackgroundLineMid: var(--ctp-crust);
	--color-pageBackgroundLineTop: var(--ctp-lavender);
	--color-pageBackgroundModalActive: var(--ctp-mantle);
	--color-pageBackgroundTopLeft: var(--ctp-mantle);
	--color-pageText: var(--ctp-text);
	--color-pageTextDark: var(--ctp-subtext1);
	--color-pageTextLight: var(--ctp-subtext0);
	--color-pageTextLink: var(--ctp-blue);
	--color-pageTextLinkLight: var(--ctp-sky);
	--color-pageTextPositive: var(--ctp-mauve);
	--color-pageTextSubdued: var(--ctp-overlay0);

	/* Pills */
	--color-pillBackground: var(--ctp-mantle);
	--color-pillBackgroundLight: var(--ctp-surface0);
	/* A tint, not solid mauve: Actual's rule stage buttons and multi-select chips paint this behind
	   the page's own text without setting pillTextSelected. */
	--color-pillBackgroundSelected: color-mix(in srgb, var(--ctp-mauve) 35%, transparent);
	--color-pillBorder: var(--ctp-line, var(--ctp-surface0));
	--color-pillBorderDark: var(--ctp-line, var(--ctp-surface0));
	--color-pillBorderSelected: var(--ctp-lavender);
	--color-pillText: var(--ctp-subtext1);
	--color-pillTextHighlighted: var(--ctp-text);
	--color-pillTextSelected: var(--ctp-text);
	--color-pillTextSubdued: var(--ctp-overlay0);

	/* Reports */
	--color-reportsBlue: var(--ctp-blue);
	--color-reportsChartFill: var(--ctp-green);
	--color-reportsGray: var(--ctp-overlay1);
	--color-reportsGreen: var(--ctp-green);
	--color-reportsInnerLabel: var(--ctp-surface2);
	--color-reportsLabel: var(--ctp-text);
	--color-settingsCardBackground: var(--color-tableBackground);
	--color-settingsCardBorder: var(--color-tableBorder);
	--color-settingsCardText: var(--color-tableText);
	--color-settingsCardTextSubdued: var(--ctp-subtext0);
	--color-settingsNavItemAccentSelected: var(--ctp-mauve);
	--color-settingsNavItemBackgroundHover: color-mix(in srgb, var(--color-settingsNavItemText) 8%, transparent);
	--color-settingsNavItemBackgroundSelected: color-mix(in srgb, var(--color-settingsNavItemAccentSelected) 18%, transparent);
	--color-settingsNavItemText: var(--ctp-text);
	--color-settingsNavItemTextSelected: var(--ctp-mauve);
	--color-reportsNumberNegative: var(--ctp-red);
	--color-reportsNumberNeutral: var(--ctp-overlay1);
	--color-reportsNumberPositive: var(--ctp-green);
	--color-reportsRed: var(--ctp-red);

	/* Sidebar */
	--color-sidebarBackground: var(--ctp-mantle);
	--color-sidebarBackgroundFailedSubtle: color-mix(in srgb, var(--ctp-red) 16%, transparent);
	--color-sidebarBorder: var(--abt-line-secondary);
	--color-sidebarBrand: var(--ctp-mauve);
	--color-sidebarBudgetName: var(--ctp-text);
	--color-sidebarControlBackground: var(--ctp-surface0);
	--color-sidebarHeaderText: var(--ctp-text);
	--color-sidebarItemAccentSelected: var(--ctp-mauve);
	--color-sidebarItemBackgroundFailed: var(--ctp-red);
	--color-sidebarItemBackgroundHover: var(--ctp-surface0);
	--color-sidebarItemBackgroundPending: var(--ctp-yellow);
	--color-sidebarItemBackgroundPositive: var(--ctp-green);
	--color-sidebarItemBackgroundSelected: color-mix(in srgb, var(--ctp-mauve) 18%, transparent);
	--color-sidebarItemText: var(--ctp-text);
	--color-sidebarItemTextSelected: var(--ctp-mauve);
	--color-sidebarItemTextUpdated: var(--ctp-blue);
	--color-sidebarTextFailed: var(--ctp-red);
	--color-sidebarTextMuted: var(--ctp-overlay1);
	--color-sidebarTextPositive: var(--ctp-green);
	--color-sidebarTextSubdued: var(--ctp-subtext0);

	/* Table */
	--color-tableBackground: var(--ctp-mantle);
	--color-tableBorder: var(--ctp-line, var(--ctp-surface0));
	--color-tableBorderHover: var(--ctp-mauve);
	--color-tableBorderSelected: var(--ctp-mauve);
	--color-tableBorderSeparator: var(--ctp-overlay0);
	--color-tableHeaderBackground: color-mix(in srgb, var(--ctp-base), var(--ctp-surface0) 25%);
	--color-tableHeaderText: var(--ctp-subtext0);
	--color-tableRowBackgroundHighlight: var(--ctp-base);
	--color-tableRowBackgroundHighlightText: var(--ctp-text);
	--color-tableRowBackgroundAlternate: var(--color-tableBackground);
	--color-tableRowBackgroundHover: var(--ctp-base);
	--color-tableRowHeaderBackground: var(--ctp-base);
	--color-tableRowHeaderText: var(--ctp-text);
	--color-tableText: var(--ctp-text);
	--color-tableTextHover: var(--ctp-overlay1);
	--color-tableTextInactive: var(--ctp-overlay1);
	--color-tableTextLight: var(--ctp-text);
	--color-tableTextSelected: var(--ctp-overlay2);
	--color-tableTextItemAdded: var(--ctp-blue);
	--color-tableTextSubdued: var(--ctp-subtext0);

	/* Template/To Budget */
	--color-templateNumberFunded: var(--ctp-green);
	--color-templateNumberUnderFunded: var(--ctp-yellow);
	--color-toBudgetNegative: var(--ctp-red);
	--color-toBudgetPositive: var(--ctp-green);
	--color-toBudgetZero: var(--ctp-green);

	/* Tooltip */
	--color-tooltipBackground: var(--ctp-mantle);
	--color-tooltipBorder: var(--abt-line-secondary);
	--color-tooltipText: var(--ctp-text);

	/* Upcoming */
	--color-upcomingBackground: color-mix(in srgb, var(--ctp-mauve) 16%, var(--ctp-base));
	--color-upcomingBorder: var(--abt-line-secondary);
	--color-upcomingText: var(--ctp-mauve);

	/* Warning */
	--color-warningBackground: color-mix(in srgb, var(--ctp-yellow) 16%, var(--ctp-base));
	--color-warningBorder: var(--ctp-peach);
	--color-warningText: var(--ctp-yellow);
	--color-warningTextDark: var(--ctp-yellow);
	--color-warningTextLight: var(--ctp-peach);

	/* Charts */
	--color-chartQual1: var(--ctp-teal);
	--color-chartQual2: var(--ctp-yellow);
	--color-chartQual3: var(--ctp-peach);
	--color-chartQual4: var(--ctp-red);
	--color-chartQual5: var(--ctp-blue);
	--color-chartQual6: var(--ctp-pink);
	--color-chartQual7: var(--ctp-green);
	--color-chartQual8: var(--ctp-mauve);
	--color-chartQual9: var(--ctp-rosewater);

	--border: 1px solid var(--color-tableBorder);
}

/* Actual's sidebar colours negative balances with the page's errorText; follow the sidebar's. */
${ACCOUNTS_LINKS} {
	--color-errorText: var(--color-sidebarTextFailed);
}

/* A bank sync provider's "Configured" uses noticeTextDark, meant for text on solid notice pills;
   here that's the page colour. Configured cards are the ones with a menu button. */
${BANK_SYNC_PROVIDER}:has(> div:first-child > button) > div:first-child > div:first-child > span {
	color: var(--color-noticeTextLight) !important;
}`;

export function isCommunityTheme(value: string): boolean {
	return value.includes("/");
}

export function applyUserPaletteTheme(id: string, keys: Record<string, string>) {
	const root = document.querySelector<HTMLElement>(":root");
	if (!root) {
		return;
	}
	clearStudioLine(root, keys);
	for (const [varName, val] of Object.entries(keys)) {
		setRootProperty(root, varName, val);
	}
	applyGlobalCSS(BUILTIN_CSS + chartCSS(keys), TOKENS_STYLE_ID);
	editorState.activeTheme = id;
	applyOverrides(id);
}

export function applyUserCSSTheme(id: string, css: string) {
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const prop of Array.from(root.style)) {
			if (prop.startsWith("--ctp-")) {
				root.style.removeProperty(prop);
			}
		}
	}
	applyGlobalCSS(css, TOKENS_STYLE_ID);
	editorState.activeTheme = id;
	applyOverrides(id);
}

export function applyOverrides(key: string) {
	const overrides = editorState.overrides[key] ?? {};
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const [prop, val] of Object.entries(overrides)) {
			setRootProperty(root, prop, val);
		}
	}
	syncWindowColor();
	// Every way of putting a theme on ends here.
	document.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
}

/**
 * Keeps the window's title bar (an installed app, or a Safari web app) on the theme: it takes the
 * theme-color tag and the body's background, which Actual resolves from its own theme, sometimes
 * before ABT's has loaded. Re-resolved when a budget opens and whenever Actual rewrites the tag.
 */
export function watchWindowColor(): void {
	watchElement(BUDGET_LINK, syncWindowColor);
	const tag = new MutationObserver(syncWindowColor);
	let watched: Element | null = null;
	// Just the tag, which Actual may add later; the rest of the head changes with every style.
	const findTag = () => {
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta && meta !== watched) {
			watched = meta;
			tag.disconnect();
			tag.observe(meta, { attributes: true, attributeFilter: ["content"] });
			syncWindowColor();
		}
	};
	new MutationObserver(findTag).observe(document.head, { childList: true });
	findTag();
	syncWindowColor();
}

/** Only with a budget open, since the budget list sets its own colour. */
export function syncWindowColor() {
	const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (!meta || !document.querySelector(BUDGET_LINK)) {
		return;
	}
	// Through a probe so a color-mix() or var() comes back as a colour the tag can hold.
	const probe = document.createElement("div");
	// Inset panels' Floating page sets --abt-window-color so the title bar meets its frame.
	probe.style.color = "var(--abt-window-color, var(--color-mobileViewTheme))";
	document.body.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	if (color && meta.content !== color) {
		meta.content = color;
		document.body.style.backgroundColor = color;
	}
}

export function applyPalette(name: string) {
	const palette = getTheme(name);
	if (!palette) {
		return;
	}
	const root = document.querySelector<HTMLElement>(":root");
	if (!root) {
		return;
	}
	clearStudioLine(root, palette.keys);
	for (const [varName, val] of Object.entries(palette.keys)) {
		setRootProperty(root, varName, val);
	}
	applyGlobalCSS(BUILTIN_CSS + chartCSS(palette.keys) + (palette.css ?? ""), TOKENS_STYLE_ID);
	editorState.activeTheme = name;
	applyOverrides(name);
}

const COMMUNITY_CATALOG_URL =
	"https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/data/customThemeCatalog.json";

export async function fetchCommunityThemeCatalog(): Promise<RemoteTheme[]> {
	const res = await browser.runtime.sendMessage({
		type: "fetch",
		responseType: "json",
		url: COMMUNITY_CATALOG_URL,
	});
	if (!res?.ok) {
		throw new Error(`Could not fetch community theme catalog (status ${res?.status})`);
	}
	return res.data;
}

export function getBuiltinPreviewColors(key: string): string[] {
	const theme = themes[key];
	if (!theme) {
		return [];
	}
	const k = theme.keys;
	return [
		k["--ctp-base"],
		k["--ctp-mantle"],
		k["--ctp-surface0"],
		k["--ctp-text"],
		k["--ctp-mauve"],
		k["--ctp-blue"],
	].filter(Boolean) as string[];
}

const NATIVE_PREVIEW_TOKENS = [
	"--color-pageBackground",
	"--color-tableBackground",
	"--color-sidebarBackground",
	"--color-pageText",
	"--color-buttonPrimaryBackground",
	"--color-pageTextLink",
];

/**
 * Actual's own colours for its current theme setting. Read from Actual's theme rule, whose
 * `var(--palette-*)` values ABT themes never override, so it's right under any ABT theme.
 */
export function getNativePreviewColors(): string[] {
	const root = getComputedStyle(document.documentElement);
	for (const sheet of document.styleSheets) {
		const owner = sheet.ownerNode;
		if (!(owner instanceof HTMLStyleElement) || owner.id.startsWith("ABT-")) {
			continue;
		}
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const rule of rules) {
			if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ":root") {
				continue;
			}
			if (!rule.style.getPropertyValue("--color-pageBackground")) {
				continue;
			}
			return NATIVE_PREVIEW_TOKENS.map((token) => {
				const value = rule.style.getPropertyValue(token).trim();
				const ref = value.match(/^var\((--[\w-]+)\)$/)?.[1];
				return ref ? root.getPropertyValue(ref).trim() : value;
			}).filter(Boolean);
		}
	}
	return [];
}

export async function fetchCommunityCSS(repo: string): Promise<string> {
	const branches = ["main", "master"];
	for (const branch of branches) {
		const url = `https://raw.githubusercontent.com/${repo}/${branch}/actual.css`;
		const res = await browser.runtime.sendMessage({ type: "fetch", url });
		if (res?.ok) {
			return res.data;
		}
	}
	throw new Error(`Could not fetch actual.css from ${repo}`);
}

export async function applyCommunityTheme(repo: string) {
	const css = await fetchCommunityCSS(repo);
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const prop of Array.from(root.style)) {
			if (prop.startsWith("--ctp-")) {
				root.style.removeProperty(prop);
			}
		}
	}
	applyGlobalCSS(css, TOKENS_STYLE_ID);
	editorState.activeTheme = repo;
	applyOverrides(repo);
}

export function applyNativeTheme() {
	applyGlobalCSS("", TOKENS_STYLE_ID);
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const [prop, original] of originalRootProperties) {
			if (original.value) {
				root.style.setProperty(prop, original.value, original.priority);
			} else {
				root.style.removeProperty(prop);
			}
		}
	}
	originalRootProperties.clear();
	editorState.activeTheme = NATIVE_THEME_KEY;
	applyOverrides(NATIVE_THEME_KEY);
}

/** Whether the page background in use is light, read from the screen as the theme paints it. */
export function pageMode(): Mode {
	const probe = document.createElement("div");
	probe.style.color = "var(--color-pageBackground)";
	document.body.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	// A canvas turns any CSS color (oklch, color-mix) into RGB.
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) {
		return "dark";
	}
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 128 ? "light" : "dark";
}

/** Paints a theme's glow and grain: a Studio theme's from its recipe, any other's as saved for it. */
export async function applyThemeEffects(key: string = editorState.activeTheme): Promise<void> {
	const recipe = isUserTheme(key) ? userThemeState.themes[key]?.recipe : undefined;
	if (recipe) {
		applyGlobalCSS(studioCSS(recipe), STUDIO_STYLE_ID);
		return;
	}
	await loadThemeEffects();
	const effects = effectsFor(key);
	applyGlobalCSS(
		effects === NO_EFFECTS ? "" : themeEffectsCSS(effects, pageMode()),
		STUDIO_STYLE_ID,
	);
}

export async function applyThemeByKey(key: string, fallback: string) {
	const recipe = isUserTheme(key) ? userThemeState.themes[key]?.recipe : undefined;
	applyGlobalCSS(recipe ? studioCSS(recipe) : "", STUDIO_STYLE_ID);
	if (key === NATIVE_THEME_KEY) {
		applyNativeTheme();
	} else if (isUserTheme(key)) {
		const userTheme = userThemeState.themes[key];
		if (userTheme) {
			if (userTheme.type === "palette" && userTheme.keys) {
				applyUserPaletteTheme(key, userTheme.keys);
			} else if (userTheme.type === "css" && userTheme.css) {
				applyUserCSSTheme(key, userTheme.css);
			}
		} else {
			applyPalette(fallback);
		}
	} else if (isCommunityTheme(key)) {
		try {
			await applyCommunityTheme(key);
		} catch {
			applyPalette(fallback);
		}
	} else {
		applyPalette(key);
	}
	if (!recipe) {
		await applyThemeEffects(key);
	}
}
