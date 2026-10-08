import { accountIconPicker } from "./appearance/account-icon-picker";
import { categoryColorDots } from "./appearance/category-color-dots";
import { categoryEmojiPicker } from "./appearance/category-emoji-picker";
import { privacyStyle } from "./appearance/privacy-dots";
import { sidebarSearch } from "./appearance/sidebar-search";
import { sidebarShortcuts } from "./appearance/sidebar-shortcuts";
import { modernTitlebar } from "./appearance/titlebar";
import { modernAccountToolbar } from "./appearance/account-toolbar";
import { modernReconcile } from "./workflows/reconcile";
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
import type { Setting } from "./types";
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

const layoutAndDensity = [
	backgroundPattern,
	borderRadius,
	budgetTableRowHeight,
	reportWidgetBackgroundColor,
	hideMonthOnScroll,
	resizableTransactionColumns,
];

const readability = [
	alternatingTransactionRows,
	budgetCardStyling,
	categoryProgress,
	balancePills,
	colorNegativeBalances,
	colorTransactions,
	dimReconciled,
	showDailyAvailable,
	highlightUncategorized,
	newTransactionStyle,
	tagStyling,
	headerBorder,
	reportCardBorders,
	budgetPageBorders,
	budgetTotalsLabelStyling,
];

const appearance = [
	experimentalSidebar,
	experimentalSidebarLayout,
	modernTitlebar,
	modernAccountToolbar,
	modernReconcile,
	modernToasts,
	privacyStyle,
	sidebarSearch,
	sidebarShortcuts,
	accountIconPicker,
	categoryColorDots,
	categoryEmojiPicker,
];

const workflows = [
	categoryTemplateInsights,
	goalFunding,
	templatePlan,
	nextMonthCoverageMethod,
	spendingCalendar,
	syncRecap,
];

const experimental = [budgetMonthHeader, budgetSummaryRow, budgetCategoryFilter];

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

export const scriptSections = [
	{
		title: "Theme",
		description: "Core visual identity for the app",
		items: [themeSelector],
	},
	{
		title: "Layout and Density",
		description: "Spacing, borders, columns, and overall compactness",
		items: layoutAndDensity,
	},
	{
		title: "Readability",
		description: "Highlights, contrast, and visual clarity",
		items: readability,
	},
	{
		title: "Appearance",
		description: "UI chrome and personalization",
		items: appearance,
	},
	{
		title: "Workflows",
		description: "Behavioral and workflow improvements",
		items: workflows,
	},
	{
		title: "Experimental",
		description: "Early previews of in-progress features",
		items: experimental,
	},
];

// Bootstrap-only settings with no dedicated settings-panel card (no `group`),
// so they don't appear in `scriptSections` but still need to be activated.
const hiddenScripts = [themeLoader];

// Derived from the same category arrays that build `scriptSections` above, so
// a feature only needs to be added to one place instead of two.
export const scripts: Setting<any>[][] = [
	[themeSelector],
	layoutAndDensity,
	readability,
	appearance,
	workflows,
	experimental,
	hiddenScripts,
];
