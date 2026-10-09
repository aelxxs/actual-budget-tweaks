import { accountIconPicker } from "./appearance/account-icon-picker";
import { categoryColorDots } from "./appearance/category-color-dots";
import { categoryEmojiPicker } from "./appearance/category-emoji-picker";
import { privacyStyle } from "./appearance/privacy-dots";
import { sidebarDensity } from "./appearance/sidebar-density";
import { sidebarGroupTotals } from "./appearance/sidebar-group-totals";
import { sidebarSearch } from "./appearance/sidebar-search";
import { sidebarShortcuts } from "./appearance/sidebar-shortcuts";
import { modernTitlebar } from "./appearance/titlebar";
import { modernAccountToolbar } from "./appearance/account-toolbar";
import { modernReconcile } from "./workflows/reconcile";
import { themedScrollbars } from "./appearance/scrollbars";
import { modernToasts } from "./appearance/toasts";
import { nativeHooks } from "./core/native-hooks";
import { privacyMode } from "./core/privacy-mode";
import { releaseNotification } from "./core/release-notification";
import { scheduleHighlight } from "./core/schedule-highlight";
import { sidePanel } from "./core/side-panel";
import { tooltipStyling } from "./core/tooltip";
import { backgroundPattern } from "./layout/background-pattern";
import { borderRadius } from "./layout/border-radius";
import { budgetTableRowHeight } from "./layout/budget-table-row-height";
import { hideMonthOnScroll } from "./layout/hide-month-on-scroll";
import { reportWidgetBackgroundColor } from "./layout/report-widget-background-color";
import { resizableTransactionColumns } from "./layout/resizable-transaction-columns";
import { alternatingTransactionRows } from "./readability/alternating-transaction-rows";
import { balancePills } from "./readability/balance-pills";
import { budgetCardStyling } from "./readability/budget-card-styling";
import { budgetPageBorders } from "./readability/budget-page-borders";
import { budgetTotalsLabelStyling } from "./readability/budget-totals-label-styling";
import { categoryProgress } from "./readability/category-progress";
import { colorNegativeBalances } from "./readability/color-negative-balances";
import { colorTransactions } from "./readability/color-transactions";
import { dimReconciled } from "./readability/dim-reconciled";
import { highlightUncategorized } from "./readability/highlight-uncategorized";
import { newTransactionStyle } from "./readability/new-transactions";
import { reportCardBorders } from "./readability/report-card-borders";
import { showDailyAvailable } from "./readability/show-daily-available";
import { tagStyling } from "./readability/tag-styling";
import { headerBorder } from "./readability/top-nav-border";
import { themeSelector } from "./theme/theme";
import { themeLoader } from "./theme/themeLoader";
import type { CoreSetting, Setting } from "./types";
import { budgetCategoryFilter } from "./workflows/budget-category-filter";
import { budgetMonthHeader } from "./workflows/budget-month-header";
import { budgetSummaryRow } from "./workflows/budget-summary-row";
import { budgetViewOptions } from "./workflows/budget-view-options";
import { categoryTemplateInsights } from "./workflows/category-template-insights";
import { goalFunding } from "./workflows/goal-funding";
import { experimentalSidebar, experimentalSidebarLayout } from "./workflows/sidebar";
import { liveSidebarNotice } from "./workflows/sidebar/notice";
import { spendingCalendar } from "./workflows/spending-calendar";
import { syncRecap } from "./workflows/sync-recap";
import { templatePlan } from "./workflows/template-plan";
import { nextMonthCoverageMethod } from "./workflows/template-plan/coverage-method";

export type PageSetting = Exclude<Setting<any>, CoreSetting>;

export interface SettingsSection {
	title: string;
	groups: { label: string | null; items: PageSetting[] }[];
}

// Grouped by where each tweak shows up in Actual, which is how people look for them.
export const scriptSections: SettingsSection[] = [
	{
		title: "Theme",
		groups: [{ label: null, items: [themeSelector] }],
	},
	{
		title: "General",
		groups: [
			{
				label: "Style",
				items: [borderRadius, backgroundPattern, themedScrollbars, headerBorder, privacyStyle],
			},
			{ label: "Components", items: [modernTitlebar, modernToasts] },
		],
	},
	{
		title: "Sidebar",
		groups: [
			{
				label: "Live sidebar",
				items: [
					experimentalSidebar,
					experimentalSidebarLayout,
					sidebarDensity,
					sidebarSearch,
					sidebarShortcuts,
				],
			},
			{
				label: "Accounts",
				items: [accountIconPicker, sidebarGroupTotals, colorNegativeBalances],
			},
		],
	},
	{
		title: "Budget",
		groups: [
			{ label: "Layout", items: [budgetTableRowHeight, hideMonthOnScroll, budgetPageBorders] },
			{
				label: "Readability",
				items: [
					budgetCardStyling,
					categoryProgress,
					balancePills,
					showDailyAvailable,
					budgetTotalsLabelStyling,
				],
			},
			{ label: "Categories", items: [categoryColorDots, categoryEmojiPicker] },
			{
				label: "Tools",
				items: [templatePlan, nextMonthCoverageMethod, categoryTemplateInsights, goalFunding],
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
			{ label: "Accounts", items: [modernAccountToolbar, modernReconcile, syncRecap] },
		],
	},
	{
		title: "Reports",
		groups: [
			{
				label: null,
				items: [reportWidgetBackgroundColor, reportCardBorders, spendingCalendar],
			},
		],
	},
	{
		title: "Experimental",
		groups: [{ label: null, items: [budgetMonthHeader, budgetSummaryRow, budgetCategoryFilter] }],
	},
];

// Settings that only do something while another (a checkbox) is on; the page dims them otherwise.
export const settingRequires = new Map<PageSetting, PageSetting>([
	[experimentalSidebarLayout, experimentalSidebar],
	[sidebarDensity, experimentalSidebar],
	[sidebarSearch, experimentalSidebar],
	[sidebarShortcuts, experimentalSidebar],
	[sidebarGroupTotals, experimentalSidebar],
	[accountIconPicker, experimentalSidebar],
	[nextMonthCoverageMethod, templatePlan],
]);

export function sectionItems(section: SettingsSection): PageSetting[] {
	return section.groups.flatMap((group) => group.items);
}

export const coreScripts = [
	sidePanel,
	nativeHooks,
	scheduleHighlight,
	tooltipStyling,
	releaseNotification,
	privacyMode,
	budgetViewOptions,
	liveSidebarNotice,
];

// Bootstrap-only settings with no settings-page row (no `group`), still activated.
const hiddenScripts = [themeLoader];

export const scripts: Setting<any>[][] = [...scriptSections.map(sectionItems), hiddenScripts];
