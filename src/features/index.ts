import { provideTweaksSections } from "@lib/utilities/settings-page";
import { accountIconPicker } from "./appearance/account-icon-picker";
import { modernAccountToolbar } from "./appearance/account-toolbar";
import { categoryColorDots } from "./appearance/category-color-dots";
import { categoryEmojiPicker } from "./appearance/category-emoji-picker";
import { privacyStyle } from "./appearance/privacy-dots";
import { sidebarClosedAccounts } from "./appearance/sidebar-closed-accounts";
import { sidebarDensity } from "./appearance/sidebar-density";
import { sidebarGroupTotals } from "./appearance/sidebar-group-totals";
import { sidebarSearch } from "./appearance/sidebar-search";
import { sidebarShortcuts, sidebarShortcutsAddTile } from "./appearance/sidebar-shortcuts";
import { modernTitlebar } from "./appearance/titlebar";
import { modernToasts } from "./appearance/toasts";
import { nativeHooks } from "./core/native-hooks";
import { privacyMode } from "./core/privacy-mode";
import { releaseNotification } from "./core/release-notification";
import { scheduleHighlight } from "./core/schedule-highlight";
import { scrollbars } from "./core/scrollbars";
import { settingsTab } from "./core/settings-tab";
import { sidePanel } from "./core/side-panel";
import { tooltipStyling } from "./core/tooltip";
import { backgroundPattern } from "./layout/background-pattern";
import { borderRadius } from "./layout/border-radius";
import { borders } from "./layout/borders";
import { budgetTableRowHeight } from "./layout/budget-table-row-height";
import { insetPanels } from "./layout/inset-panels";
import { modernHeaders } from "./layout/modern-headers";
import { resizableTransactionColumns } from "./layout/resizable-transaction-columns";
import { mobileAccounts } from "./mobile/accounts";
import { mobileBudgetBanners } from "./mobile/budget-banners";
import { mobileBudgetCards } from "./mobile/budget-cards";
import { mobileHeader } from "./mobile/header";
import { mobileModalSheets } from "./mobile/modal-sheets";
import { mobilePageTransitions } from "./mobile/page-transitions";
import { mobileTabBar } from "./mobile/tab-bar";
import { mobileToasts } from "./mobile/toasts";
import { mobileTransactionList } from "./mobile/transaction-list";
import { alternatingTransactionRows } from "./readability/alternating-transaction-rows";
import { balancePills } from "./readability/balance-pills";
import { categoryProgress } from "./readability/category-progress";
import { colorAmounts } from "./readability/color-amounts";
import { groupOverspent } from "./readability/group-overspent";
import { rowStatus } from "./readability/row-status";
import { quietCategoryIcons } from "./readability/quiet-category-icons";
import { showDailyAvailable } from "./readability/show-daily-available";
import { tagStyling } from "./readability/tag-styling";
import { themeSelector } from "./theme/theme";
import { themeLoader } from "./theme/theme-loader";
import type { CoreSetting, Setting } from "./types";
import { budgetCategoryFilter } from "./workflows/budget-category-filter";
import { monthCards } from "./workflows/budget-summary-row";
import { budgetViewOptions } from "./workflows/budget-view-options";
import { categoryTemplateInsights } from "./workflows/category-template-insights";
import { incomeBreakdown } from "./workflows/income-breakdown";
import { modernReconcile } from "./workflows/reconcile";
import { experimentalSidebar, experimentalSidebarLayout } from "./workflows/sidebar";
import { customizeSidebarEntry } from "./workflows/sidebar/customize-entry";
import { liveSidebarNotice } from "./workflows/sidebar/notice";
import { spendingCalendar } from "./workflows/spending-calendar";
import { syncRecap } from "./workflows/sync-recap";
import { templatePlan } from "./workflows/template-plan";
import { transactionInspector } from "./workflows/transaction-inspector";

export type PageSetting = Exclude<Setting<any>, CoreSetting>;

export interface SettingsSection {
	title: string;
	/** Edited elsewhere, named here; the page lists the section only in search and Changed. */
	elsewhere?: string;
	/** A fixed header with an empty slot (`[data-section-slot]`) its setting fills; it doesn't collapse. */
	headerSlot?: boolean;
	/** One of its items, drawn as a switch in the header in place of collapsing; the rest show while it's on. */
	switch?: PageSetting;
	groups: { label: string | null; items: PageSetting[] }[];
}

// How Actual looks across every page, edited from Theme → Style and Theme Studio.
export const styleSettings: PageSetting[] = [borderRadius, backgroundPattern, insetPanels, borders];

/** Its section starts collapsed once every feature in it is on. */
export const FEATURES_TITLE = "Features";

// Grouped by where each tweak shows up in Actual, which is how people look for them.
export const scriptSections: SettingsSection[] = [
	{
		title: "Theme",
		headerSlot: true,
		groups: [{ label: null, items: [themeSelector] }],
	},
	{
		title: "Features",
		groups: [
			{
				label: null,
				items: [
					templatePlan,
					spendingCalendar,
					modernReconcile,
					syncRecap,
					transactionInspector,
					incomeBreakdown,
				],
			},
		],
	},
	{
		title: "Style",
		elsewhere: "Theme → Style",
		groups: [{ label: null, items: styleSettings }],
	},
	{
		title: "General",
		groups: [
			{
				label: "Components",
				items: [
					modernTitlebar,
					modernHeaders,
					budgetCategoryFilter,
					modernAccountToolbar,
					modernToasts,
				],
			},
			{ label: "Amounts", items: [colorAmounts, privacyStyle] },
		],
	},
	{
		title: "Sidebar",
		switch: experimentalSidebar,
		groups: [{ label: null, items: [experimentalSidebar, customizeSidebarEntry] }],
	},
	{
		title: "Customize sidebar",
		elsewhere: "the sidebar's Customize panel",
		groups: [
			{
				label: null,
				items: [
					experimentalSidebarLayout,
					sidebarDensity,
					sidebarSearch,
					sidebarShortcuts,
					accountIconPicker,
					sidebarGroupTotals,
					sidebarClosedAccounts,
				],
			},
		],
	},
	{
		title: "Budget",
		groups: [
			{
				label: "Layout",
				items: [budgetTableRowHeight, monthCards],
			},
			{
				label: "Readability",
				items: [categoryProgress, balancePills, categoryTemplateInsights, groupOverspent],
			},
			{
				label: "Categories",
				items: [categoryColorDots, categoryEmojiPicker, quietCategoryIcons],
			},
		],
	},
	{
		title: "Accounts & Transactions",
		groups: [
			{
				label: null,
				items: [
					alternatingTransactionRows,
					rowStatus,
					tagStyling,
					resizableTransactionColumns,
					showDailyAvailable,
				],
			},
		],
	},
	{
		title: "Mobile",
		groups: [
			{
				label: null,
				items: [
					mobileHeader,
					mobileTabBar,
					mobileBudgetCards,
					mobileAccounts,
					mobileBudgetBanners,
					mobileModalSheets,
					mobileTransactionList,
					mobileToasts,
					mobilePageTransitions,
				],
			},
		],
	},
];

// The nav lists the desktop sections the settings page shows unfiltered.
provideTweaksSections(() =>
	scriptSections
		.filter((section) => !section.elsewhere)
		.map((section) => ({
			title: section.title,
			count: sectionItems(section).filter((item) => (item.platform ?? "desktop") !== "mobile")
				.length,
		}))
		.filter((section) => section.count > 0),
);

// Settings that only do something while another (a checkbox) is on; the page dims them otherwise.
export const settingRequires = new Map<PageSetting, PageSetting>([
	[customizeSidebarEntry, experimentalSidebar],
	[experimentalSidebarLayout, experimentalSidebar],
	[sidebarDensity, experimentalSidebar],
	[sidebarSearch, experimentalSidebar],
	[sidebarShortcuts, experimentalSidebar],
	[sidebarGroupTotals, experimentalSidebar],
	[sidebarClosedAccounts, experimentalSidebar],
	[accountIconPicker, experimentalSidebar],
	[budgetCategoryFilter, modernHeaders],
]);

export function sectionItems(section: SettingsSection): PageSetting[] {
	return section.groups.flatMap((group) => group.items);
}

export const coreScripts = [
	sidePanel,
	nativeHooks,
	settingsTab,
	scheduleHighlight,
	tooltipStyling,
	scrollbars,
	releaseNotification,
	privacyMode,
	budgetViewOptions,
	liveSidebarNotice,
];

// Bootstrap-only settings with no settings-page row (no `group`), still activated.
// The add tile's switch lives in the Customize sidebar panel; listed so it syncs with the budget.
const hiddenScripts = [themeLoader, sidebarShortcutsAddTile];

export const scripts: Setting<any>[][] = [...scriptSections.map(sectionItems), hiddenScripts];
