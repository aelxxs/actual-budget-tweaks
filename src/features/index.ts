import { accountIconPicker } from "./appearance/account-icon-picker";
import { categoryColorDots } from "./appearance/category-color-dots";
import { categoryEmojiPicker } from "./appearance/category-emoji-picker";
import { sidebarIcons } from "./appearance/sidebar-icons";
import { sidebarRedesign } from "./appearance/sidebar-redesign";
import { sidebarSearch } from "./appearance/sidebar-search";
import { sidebarSettingsMenu } from "./appearance/sidebar-settings-menu";
import { sidebarShortcuts } from "./appearance/sidebar-shortcuts";
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
import { sidebarAccountSpacing } from "./layout/sidebar-account-spacing";
import { toggleColumns } from "./layout/toggle-columns";
import { alternatingTransactionRows } from "./readability/alternating-transaction-rows";
import { budgetCardStyling } from "./readability/budget-card-styling";
import { budgetPageBorders } from "./readability/budget-page-borders";
import { budgetTotalsLabelStyling } from "./readability/budget-totals-label-styling";
import { categoryProgress } from "./readability/category-progress";
import { colorNegativeBalances } from "./readability/color-negative-balances";
import { colorTransactions } from "./readability/color-transactions";
import { dimReconciled } from "./readability/dim-reconciled";
import { highlightUncategorized } from "./readability/highlight-uncategorized";
import { notificationContrast } from "./readability/notification-contrast";
import { reportCardBorders } from "./readability/report-card-borders";
import { showDailyAvailable } from "./readability/show-daily-available";
import { tagStyling } from "./readability/tag-styling";
import { headerBorder } from "./readability/top-nav-border";
import { themeSelector } from "./theme/theme";
import { themeLoader } from "./theme/themeLoader";
import type { Setting } from "./types";
import { categoryTemplateInsights } from "./workflows/category-template-insights";
import { spendingCalendar } from "./workflows/spending-calendar";
import { templatePlan } from "./workflows/template-plan";

const layoutAndDensity = [
	backgroundPattern,
	borderRadius,
	budgetTableRowHeight,
	reportWidgetBackgroundColor,
	hideMonthOnScroll,
	toggleColumns,
	resizableTransactionColumns,
	sidebarAccountSpacing,
];

const readability = [
	alternatingTransactionRows,
	budgetCardStyling,
	categoryProgress,
	colorNegativeBalances,
	colorTransactions,
	dimReconciled,
	notificationContrast,
	showDailyAvailable,
	highlightUncategorized,
	tagStyling,
	headerBorder,
	reportCardBorders,
	budgetPageBorders,
	budgetTotalsLabelStyling,
];

const appearance = [
	sidebarRedesign,
	sidebarIcons,
	sidebarSearch,
	sidebarShortcuts,
	accountIconPicker,
	categoryColorDots,
	categoryEmojiPicker,
];

const workflows = [categoryTemplateInsights, templatePlan, spendingCalendar];

export const coreScripts = [
	sidePanel,
	scheduleHighlight,
	tooltipStyling,
	releaseNotification,
	privacyMode,
	sidebarSettingsMenu,
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
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scripts: Setting<any>[][] = [
	[themeSelector],
	[backgroundPattern, borderRadius, budgetTableRowHeight],
	[reportWidgetBackgroundColor, toggleColumns, sidebarAccountSpacing],
	[
		alternatingTransactionRows,
		budgetCardStyling,
		categoryProgress,
		colorNegativeBalances,
		colorTransactions,
		dimReconciled,
		hideMonthOnScroll,
		notificationContrast,
		resizableTransactionColumns,
		showDailyAvailable,
		sidebarRedesign,
		sidebarIcons,
		sidebarSearch,
		sidebarShortcuts,
		spendingCalendar,
		accountIconPicker,
		categoryColorDots,
		categoryEmojiPicker,
		categoryTemplateInsights,
		templatePlan,
		highlightUncategorized,
		tagStyling,
		headerBorder,
		reportCardBorders,
		budgetPageBorders,
		budgetTotalsLabelStyling,
		themeLoader,
	],
];
