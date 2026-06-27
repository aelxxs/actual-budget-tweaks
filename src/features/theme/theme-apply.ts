import { getTheme } from "@lib/design";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { editorState } from "./editor-state.svelte";
import { isUserTheme, userThemeState } from "./user-themes.svelte";

export const TOKENS_STYLE_ID = "color-tokens";

export const BUILTIN_CSS = `:root {
	/* Budget */
	--color-budgetCurrentMonth: var(--ctp-crust);
	--color-budgetHeaderCurrentMonth: var(--ctp-base);
	--color-budgetHeaderOtherMonth: var(--ctp-base);
	--color-budgetOtherMonth: var(--ctp-mantle);
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
	--color-buttonMenuBorder: var(--ctp-surface0);
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
	--color-buttonNormalBorder: var(--ctp-surface0);
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

	/* Card */
	--color-cardBackground: var(--ctp-crust);
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
	--color-errorBackground: var(--ctp-base);
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
	--color-formInputBorder: var(--ctp-surface0);
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
	--color-menuBorder: var(--ctp-surface0);
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
	--color-mobileHeaderBackground: var(--ctp-base);
	--color-mobileHeaderText: var(--ctp-lavender);
	--color-mobileHeaderTextHover: rgba(205, 214, 244, 0.07);
	--color-mobileHeaderTextSubdued: var(--ctp-subtext0);
	--color-mobileNavBackground: var(--ctp-mantle);
	--color-mobileNavItem: var(--ctp-text);
	--color-mobileNavItemSelected: var(--ctp-lavender);
	--color-mobilePageBackground: var(--ctp-base);
	--color-mobileTransactionSelected: var(--ctp-lavender);
	--color-mobileViewTheme: var(--ctp-base);

	--color-modalBackground: var(--ctp-crust);
	--color-modalBorder: var(--ctp-surface0);

	/* Notes */
	--color-noteTagBackground: var(--ctp-mauve);
	--color-noteTagBackgroundHover: var(--ctp-pink);
	--color-noteTagDefault: var(--ctp-mauve);
	--color-noteTagText: var(--ctp-crust);

	/* Notices */
	--color-noticeBackground: var(--ctp-teal);
	--color-noticeBackgroundDark: var(--ctp-teal);
	--color-noticeBackgroundLight: var(--ctp-teal);
	--color-noticeBorder: var(--ctp-green);
	--color-noticeText: var(--ctp-text);
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
	--color-pageTextPositive: var(--ctp-green);
	--color-pageTextSubdued: var(--ctp-overlay0);

	/* Pills */
	--color-pillBackground: var(--ctp-mantle);
	--color-pillBackgroundLight: var(--ctp-surface0);
	--color-pillBackgroundSelected: var(--ctp-mauve);
	--color-pillBorder: var(--ctp-surface0);
	--color-pillBorderDark: var(--ctp-surface0);
	--color-pillBorderSelected: var(--ctp-lavender);
	--color-pillText: var(--ctp-subtext1);
	--color-pillTextHighlighted: var(--ctp-text);
	--color-pillTextSelected: var(--ctp-base);
	--color-pillTextSubdued: var(--ctp-overlay0);

	/* Reports */
	--color-reportsBlue: var(--ctp-blue);
	--color-reportsChartFill: var(--ctp-green);
	--color-reportsGray: var(--ctp-overlay1);
	--color-reportsGreen: var(--ctp-green);
	--color-reportsInnerLabel: var(--ctp-surface2);
	--color-reportsLabel: var(--ctp-text);
	--color-reportsNumberNegative: var(--ctp-red);
	--color-reportsNumberNeutral: var(--ctp-overlay1);
	--color-reportsNumberPositive: var(--ctp-green);
	--color-reportsRed: var(--ctp-red);

	/* Sidebar */
	--color-sidebarBackground: var(--ctp-mantle);
	--color-sidebarBudgetName: var(--ctp-text);
	--color-sidebarItemAccentSelected: var(--ctp-mauve);
	--color-sidebarItemBackgroundFailed: var(--ctp-red);
	--color-sidebarItemBackgroundHover: var(--ctp-surface0);
	--color-sidebarItemBackgroundPending: var(--ctp-yellow);
	--color-sidebarItemBackgroundPositive: var(--ctp-green);
	--color-sidebarItemText: var(--ctp-text);
	--color-sidebarItemTextSelected: var(--ctp-mauve);

	/* Table */
	--color-tableBackground: var(--ctp-mantle);
	--color-tableBorder: var(--ctp-surface0);
	--color-tableBorderHover: var(--ctp-mauve);
	--color-tableBorderSelected: var(--ctp-blue);
	--color-tableBorderSeparator: var(--ctp-overlay0);
	--color-tableHeaderBackground: var(--ctp-crust);
	--color-tableHeaderText: var(--ctp-subtext0);
	--color-tableHeaderSubText: var(--ctp-text);
	--color-tableRowBackgroundHighlight: var(--ctp-base);
	--color-tableRowBackgroundHighlightText: var(--ctp-text);
	--color-tableRowBackgroundHover: var(--ctp-base);
	--color-tableRowHeaderBackground: var(--ctp-base);
	--color-tableRowHeaderText: var(--ctp-text);
	--color-tableText: var(--ctp-text);
	--color-tableTextHover: var(--ctp-overlay1);
	--color-tableTextInactive: var(--ctp-overlay1);
	--color-tableTextLight: var(--ctp-text);
	--color-tableTextSelected: var(--ctp-overlay2);
	--color-tableTextSubdued: var(--ctp-subtext0);

	/* Template/To Budget */
	--color-templateNumberFunded: var(--ctp-green);
	--color-templateNumberUnderFunded: var(--ctp-yellow);
	--color-toBudgetNegative: var(--ctp-red);
	--color-toBudgetPositive: var(--ctp-green);
	--color-toBudgetZero: var(--ctp-green);

	/* Tooltip */
	--color-tooltipBackground: var(--ctp-mantle);
	--color-tooltipBorder: var(--ctp-surface0);
	--color-tooltipText: var(--ctp-text);

	/* Upcoming */
	--color-upcomingBackground: var(--ctp-mauve);
	--color-upcomingBorder: var(--ctp-surface0);
	--color-upcomingText: var(--ctp-mantle);

	/* Warning */
	--color-warningBackground: var(--ctp-base);
	--color-warningBorder: var(--ctp-peach);
	--color-warningText: var(--ctp-yellow);
	--color-warningTextDark: var(--ctp-text);
	--color-warningTextLight: var(--ctp-peach);

	/* Charts */
	--color-chartQual1: var(--ctp-teal);
	--color-chartQual2: var(--ctp-yellow);
	--color-chartQual3: var(--ctp-peach);
	--color-chartQual4: var(--ctp-red);
	--color-chartQual5: var(--ctp-blue);
	--color-chartQual6: var(--ctp-pink);
	--color-chartQual7: var(--ctp-green);
	--color-chartQual8: var(--ctp-gold);
	--color-chartQual9: var(--ctp-rosewater);

	--border: 1px solid var(--color-tableBorder);
}`;

export function isCommunityTheme(value: string): boolean {
	return value.includes("/");
}

export function applyUserPaletteTheme(id: string, keys: Record<string, string>) {
	const root = document.querySelector<HTMLElement>(":root");
	if (!root) return;
	for (const [varName, val] of Object.entries(keys)) {
		root.style.setProperty(varName, val);
	}
	applyGlobalCSS(BUILTIN_CSS, TOKENS_STYLE_ID);
	editorState.activeTheme = id;
	applyOverrides(id);
}

export function applyUserCSSTheme(id: string, css: string) {
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const prop of Array.from(root.style)) {
			if (prop.startsWith("--ctp-")) root.style.removeProperty(prop);
		}
	}
	applyGlobalCSS(css, TOKENS_STYLE_ID);
	editorState.activeTheme = id;
	applyOverrides(id);
}

export function applyOverrides(key: string) {
	const overrides = editorState.overrides[key];
	if (!overrides || Object.keys(overrides).length === 0) return;
	const root = document.querySelector<HTMLElement>(":root");
	if (!root) return;
	for (const [prop, val] of Object.entries(overrides)) {
		root.style.setProperty(prop, val);
	}
}

export function applyPalette(name: string) {
	const palette = getTheme(name);
	if (!palette) return;
	const root = document.querySelector<HTMLElement>(":root");
	if (!root) return;
	for (const [varName, val] of Object.entries(palette.keys)) {
		root.style.setProperty(varName, val);
	}
	applyGlobalCSS(BUILTIN_CSS, TOKENS_STYLE_ID);
	editorState.activeTheme = name;
	applyOverrides(name);
}

export async function fetchCommunityCSS(repo: string): Promise<string> {
	const branches = ["main", "master"];
	for (const branch of branches) {
		const url = `https://raw.githubusercontent.com/${repo}/${branch}/actual.css`;
		const res = await browser.runtime.sendMessage({ type: "fetch", url });
		if (res?.ok) return res.data;
	}
	throw new Error(`Could not fetch actual.css from ${repo}`);
}

export async function applyCommunityTheme(repo: string) {
	const css = await fetchCommunityCSS(repo);
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const prop of Array.from(root.style)) {
			if (prop.startsWith("--ctp-")) root.style.removeProperty(prop);
		}
	}
	applyGlobalCSS(css, TOKENS_STYLE_ID);
	editorState.activeTheme = repo;
	applyOverrides(repo);
}

export async function applyThemeByKey(key: string, fallback: string) {
	if (isUserTheme(key)) {
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
}
