import { ACCOUNTS_LINKS, BANK_SYNC_PROVIDER } from "@lib/actual-dom";
import type { PaletteTheme } from "@lib/design/types";
import { hexToOklch, oklchToHex } from "./studio/generator";

/**
 * Charts' colours in order: the link-and-chart family and the accent first, so Theme Studio's
 * family setting shapes them; status colours last, and red not at all, so a slice isn't read as overspent.
 */
export const CHART_KEYS = [
	"blue",
	"mauve",
	"teal",
	"peach",
	"sapphire",
	"pink",
	"sky",
	"green",
	"yellow",
];

const isHex = (value: string | undefined): value is string => /^#[\da-f]{6}$/i.test(value ?? "");

/**
 * Charts' colours as hex, since Actual's donut chart parses only hex when shading categories and
 * greys out anything else. A theme's own `--theme-chart-N` as given; otherwise its palette colour
 * for the slot, with soft pastels lifted (chroma toward a 0.17 floor).
 */
function chartCSS(keys: Record<string, string>): string {
	const lines = CHART_KEYS.flatMap((name, i) => {
		const own = keys[`--theme-chart-${i + 1}`];
		if (isHex(own)) {
			return [`--color-chartQual${i + 1}: ${own};`];
		}
		const hex = keys[`--ctp-${name}`];
		if (!isHex(hex)) {
			return [];
		}
		const { L, C, h } = hexToOklch(hex);
		return [
			`--color-chartQual${i + 1}: ${oklchToHex(L, Math.max(C, Math.min(C * 1.5, 0.17)), h)};`,
		];
	});
	return lines.length ? `:root {\n\t${lines.join("\n\t")}\n}\n` : "";
}

const BUILTIN_CSS = `
	:root {
		/* Borders without a theme line colour; light themes set theirs a step deeper. */
		--abt-border-rest: var(--ctp-surface0);
		/* Theme Studio's borders: tables and controls take its border color in full; containers and
		dividers (menus, modals, panels) a step below. Without one, both are surface0. */
		--abt-line-secondary: color-mix(in oklab, var(--theme-line, var(--abt-border-rest)) 50%, var(--ctp-surface0));
		/* Budget */
		--color-budgetCurrentMonth: var(--ctp-mantle);
		/* Group rows well past a hovered row (base), so they stand off the table. */
		--color-budgetHeaderCurrentMonth: color-mix(in srgb, var(--ctp-mantle), var(--ctp-surface0) 55%);
		--color-budgetHeaderOtherMonth: var(--color-budgetHeaderCurrentMonth);
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
		--color-buttonMenuBorder: var(--theme-line, var(--abt-border-rest));
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
		--color-buttonNormalBorder: var(--theme-line, var(--abt-border-rest));
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
		--color-formInputBorder: var(--theme-line, var(--abt-border-rest));
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
		--color-pillBorder: var(--theme-line, var(--abt-border-rest));
		--color-pillBorderDark: var(--theme-line, var(--abt-border-rest));
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
		--color-sidebarBackground: var(--theme-sidebar, var(--ctp-mantle));
		--color-sidebarBackgroundFailedSubtle: color-mix(in srgb, var(--ctp-red) 16%, transparent);
		--color-sidebarBorder: var(--theme-sidebar-hover, var(--abt-line-secondary));
		--color-sidebarBrand: var(--theme-sidebar-sel, var(--ctp-mauve));
		--color-sidebarBudgetName: var(--theme-sidebar-text, var(--ctp-text));
		--color-sidebarControlBackground: var(--theme-sidebar-hover, var(--ctp-surface0));
		--color-sidebarHeaderText: var(--theme-sidebar-text, var(--ctp-text));
		--color-sidebarItemAccentSelected: var(--ctp-mauve);
		--color-sidebarItemBackgroundFailed: var(--ctp-red);
		--color-sidebarItemBackgroundHover: var(--theme-sidebar-hover, var(--ctp-surface0));
		--color-sidebarItemBackgroundPending: var(--ctp-yellow);
		--color-sidebarItemBackgroundPositive: var(--ctp-green);
		--color-sidebarItemBackgroundSelected: color-mix(in srgb, var(--theme-sidebar-sel, var(--ctp-mauve)) 18%, transparent);
		--color-sidebarItemText: var(--theme-sidebar-text, var(--ctp-text));
		--color-sidebarItemTextSelected: var(--theme-sidebar-sel, var(--ctp-mauve));
		--color-sidebarItemTextUpdated: var(--theme-sidebar-updated, var(--ctp-blue));
		--color-sidebarTextFailed: var(--theme-sidebar-neg, var(--ctp-red));
		--color-sidebarTextMuted: var(--theme-sidebar-sub, var(--ctp-overlay1));
		--color-sidebarTextPositive: var(--ctp-green);
		--color-sidebarTextSubdued: var(--theme-sidebar-sub, var(--ctp-subtext0));

		/* Table */
		--color-tableBackground: var(--ctp-mantle);
		--color-tableBorder: var(--theme-line, var(--abt-border-rest));
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
		${CHART_KEYS.map((key, i) => `--color-chartQual${i + 1}: var(--ctp-${key});`).join("\n\t\t")}

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
	}
`;

/**
 * The data colour is always blue, so it means the same in every theme: a theme's own
 * `--theme-data`, else its palette blue when it is one, else blue at that blue's lightness.
 */
function dataCSS(keys: Record<string, string>): string {
	const own = keys["--theme-data"];
	if (isHex(own)) {
		return `:root {\n\t--abt-data: ${own};\n}\n`;
	}
	const hex = keys["--ctp-blue"];
	if (!isHex(hex)) {
		return "";
	}
	const { L, C, h } = hexToOklch(hex);
	const data = h >= 225 && h <= 280 && C >= 0.06 ? hex : oklchToHex(L, Math.max(C, 0.12), 255);
	return `:root {\n\t--abt-data: ${data};\n}\n`;
}

/** Light themes: controls raised over the page, a firmer wash, paler other months. */
const LIGHT_CSS = `
	:root {
		--color-budgetCurrentMonth: color-mix(in oklab, var(--ctp-mantle), var(--ctp-base) 15%);
		/* A sidebar without its own colour matches the cards as they're shown. */
		--color-sidebarBackground: var(--theme-sidebar, var(--color-budgetCurrentMonth));
		/* Group rows a step deeper, so they stand off the table. */
		--color-budgetHeaderCurrentMonth: color-mix(in oklab, var(--ctp-base), var(--ctp-surface0) 65%);
		/* Borders between surface0 and surface1, so they show beside the group rows. */
		--abt-border-rest: color-mix(in oklab, var(--ctp-surface0), var(--ctp-surface1));
		--color-budgetOtherMonth: color-mix(in oklab, var(--color-budgetCurrentMonth), white 50%);
		--color-budgetHeaderOtherMonth: color-mix(in srgb, var(--ctp-mantle), var(--ctp-surface0) 35%);
		/* Deep accents wash out at the dark themes' strength. */
		--abt-wash: 22%;
	}
	/* Controls raised on a solid surface. Only controls: hovers, tags and chips stay a tint, which
	   a solid surface would hide on the near-white cards and popovers. */
	:root,
	.abt-controls-quiet {
		--abt-control-bg: var(--ctp-base);
		--abt-line: var(--ctp-surface1);
	}
	/* Surfaces with their own ink keep tinted controls, as they did before. */
	.sidebar,
	.abt-on-sidebar,
	.abt-popover {
		--abt-control-bg: initial;
	}
`;

/** Page colours that ABT's sidebar tiles use, remade for a sidebar with its own background. */
const SIDEBAR_CSS = `
	.sidebar {
		--abt-accent: var(--theme-sidebar-sel);
		--color-sidebarItemAccentSelected: var(--theme-sidebar-sel);
		--color-pageText: var(--theme-sidebar-text);
		--color-pageTextSubdued: var(--theme-sidebar-sub);
		--color-sidebarTextPositive: var(--theme-sidebar-pos);
		--color-noticeTextLight: var(--theme-sidebar-pos);
		--color-errorText: var(--theme-sidebar-neg);
		--color-sidebarItemBackgroundFailed: var(--theme-sidebar-neg);
		--color-sidebarItemBackgroundPositive: var(--theme-sidebar-pos);
		--color-sidebarItemBackgroundPending: var(--theme-sidebar-warn);
		--color-warningText: var(--theme-sidebar-warn);
		--color-tableBorder: var(--theme-sidebar-hover);
	}
`;

/** Raised borders (a theme with `--theme-line`) reach ABT's own panels and cards too, which otherwise draw a faint ink tint. */
const BORDERS_CSS = `
	:root:root {
		--abt-line: var(--theme-line);
		--abt-panel-border: var(--abt-line-secondary);
	}
`;

/** The sidebar's lines, a step below its border colour as the page's containers are. A sidebar of
 * its own has a border colour made for its background; one that matches the page uses the page's. */
const SIDEBAR_BORDERS_CSS = `
	:root:root {
		--abt-sidebar-line: color-mix(
			in oklab,
			var(--theme-sidebar-line, var(--theme-line)) 50%,
			var(--theme-sidebar-hover, var(--ctp-surface0))
		);
		--color-sidebarBorder: var(--abt-sidebar-line);
	}
	.sidebar.sidebar {
		--sb-line: var(--abt-sidebar-line);
	}
`;

/** Everything a palette theme paints beyond its colours, the same for built-in and Studio themes. */
export function paletteCSS(theme: PaletteTheme): string {
	let css = BUILTIN_CSS + "\n";
	if (theme.mode === "light") {
		css += LIGHT_CSS;
	}
	css += chartCSS(theme.keys);
	css += dataCSS(theme.keys);
	// Only for themes with a sidebar of their own, so a user's overrides of these page colours still reach it.
	if ("--theme-sidebar" in theme.keys) {
		css += SIDEBAR_CSS;
	}
	if ("--theme-line" in theme.keys) {
		css += BORDERS_CSS;
	}
	// A line made for the page can come out near white on a dark sidebar, so one of its own needs its own.
	const ownSidebar = "--theme-sidebar" in theme.keys;
	if (ownSidebar ? "--theme-sidebar-line" in theme.keys : "--theme-line" in theme.keys) {
		css += SIDEBAR_BORDERS_CSS;
	}
	return css;
}
