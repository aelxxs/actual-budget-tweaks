import { accountIconPicker } from "./appearance/account-icon-picker";
import { modernAccountToolbar } from "./appearance/account-toolbar";
import { categoryColorDots } from "./appearance/category-color-dots";
import { categoryEmojiPicker } from "./appearance/category-emoji-picker";
import { privacyStyle } from "./appearance/privacy-dots";
import { themedScrollbars } from "./appearance/scrollbars";
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
import { budgetTotalsLabelStyling } from "./readability/budget-totals-label-styling";
import { categoryProgress } from "./readability/category-progress";
import { colorNegativeBalances } from "./readability/color-negative-balances";
import { colorTransactions } from "./readability/color-transactions";
import { dimReconciled } from "./readability/dim-reconciled";
import { groupOverspent } from "./readability/group-overspent";
import { highlightUncategorized } from "./readability/highlight-uncategorized";
import { newTransactionStyle } from "./readability/new-transactions";
import { quietCategoryIcons } from "./readability/quiet-category-icons";
import { scheduleIconDetails } from "./readability/schedule-icon-details";
import { showDailyAvailable } from "./readability/show-daily-available";
import { tagStyling } from "./readability/tag-styling";
import { themeMenu } from "./theme/menu";
import { themeSelector } from "./theme/theme";
import { themeLoader } from "./theme/theme-loader";
import type { CoreSetting, Setting } from "./types";
import { budgetCategoryFilter } from "./workflows/budget-category-filter";
import { monthCards } from "./workflows/budget-summary-row";
import { budgetViewOptions } from "./workflows/budget-view-options";
import { categoryTemplateInsights } from "./workflows/category-template-insights";
import { hideFundedTemplateBars } from "./workflows/category-template-insights/hide-funded";
import { goalFunding } from "./workflows/goal-funding";
import { incomeBreakdown } from "./workflows/income-breakdown";
import { modernReconcile } from "./workflows/reconcile";
import { reconcileConfetti } from "./workflows/reconcile/confetti";
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
export const styleSettings: PageSetting[] = [
	borderRadius,
	backgroundPattern,
	insetPanels,
	themedScrollbars,
	borders,
	privacyStyle,
];

// Grouped by where each tweak shows up in Actual, which is how people look for them.
export const scriptSections: SettingsSection[] = [
	{
		title: "Theme",
		headerSlot: true,
		groups: [{ label: null, items: [themeSelector] }],
	},
	{
		title: "Style",
		elsewhere: "Theme → Style",
		groups: [{ label: null, items: styleSettings }],
	},
	{
		title: "General",
		groups: [
			{ label: "Components", items: [modernTitlebar, modernHeaders, themeMenu, modernToasts] },
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
					colorNegativeBalances,
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
				items: [
					categoryProgress,
					balancePills,
					groupOverspent,
					scheduleIconDetails,
					showDailyAvailable,
					budgetTotalsLabelStyling,
				],
			},
			{
				label: "Categories",
				items: [categoryColorDots, categoryEmojiPicker, quietCategoryIcons, budgetCategoryFilter],
			},
			{
				label: "Tools",
				items: [templatePlan, categoryTemplateInsights, hideFundedTemplateBars, goalFunding],
			},
		],
	},
	{
		title: "Accounts & Transactions",
		groups: [
			{
				label: "Transactions",
				items: [
					alternatingTransactionRows,
					colorTransactions,
					dimReconciled,
					highlightUncategorized,
					newTransactionStyle,
					tagStyling,
					resizableTransactionColumns,
				],
			},
			{
				label: "Accounts",
				items: [
					modernAccountToolbar,
					modernReconcile,
					reconcileConfetti,
					syncRecap,
					transactionInspector,
				],
			},
		],
	},
	{
		title: "Reports",
		groups: [
			{
				label: null,
				items: [spendingCalendar, incomeBreakdown],
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
	[hideFundedTemplateBars, categoryTemplateInsights],
	[reconcileConfetti, modernReconcile],
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
	releaseNotification,
	privacyMode,
	budgetViewOptions,
	liveSidebarNotice,
];

// Bootstrap-only settings with no settings-page row (no `group`), still activated.
// The add tile's switch lives in the Customize sidebar panel; listed so it syncs with the budget.
const hiddenScripts = [themeLoader, sidebarShortcutsAddTile];

export const scripts: Setting<any>[][] = [...scriptSections.map(sectionItems), hiddenScripts];
