import { accountIconPicker } from "./appearance/account-icon-picker";
import { imageWidgets } from "./appearance/image-widgets";
import { sidebarIcons } from "./appearance/sidebar-icons";
import { sidebarRedesign } from "./appearance/sidebar-redesign";
import { scheduleHighlight } from "./core/schedule-highlight";
import { sidePanel } from "./core/side-panel";
import { backgroundPattern } from "./layout/background-pattern";
import { borderRadius } from "./layout/border-radius";
import { budgetTableRowHeight } from "./layout/budget-table-row-height";
import { hideMonthOnScroll } from "./layout/hide-month-on-scroll";
import { reportWidgetBackgroundColor } from "./layout/report-widget-background-color";
import { resizableTransactionColumns } from "./layout/resizable-transaction-columns";
import { sidebarAccountSpacing } from "./layout/sidebar-account-spacing";
import { toggleColumns } from "./layout/toggle-columns";
import { budgetPageBorders } from "./readability/budget-page-borders";
import { colorNegativeBalances } from "./readability/color-negative-balances";
import { colorTransactions } from "./readability/color-transactions";
import { dimReconciled } from "./readability/dim-reconciled";
import { notificationContrast } from "./readability/notification-contrast";
import { reportCardBorders } from "./readability/report-card-borders";
import { showDailyAvailable } from "./readability/show-daily-available";
import { headerBorder } from "./readability/top-nav-border";
import { themeSelector } from "./theme/theme";
import { themeLoader } from "./theme/themeLoader";
import type { Setting } from "./types";
import { categoryTemplateInsights } from "./workflows/category-template-insights";
import { templateApplyBreakdown } from "./workflows/template-apply-breakdown";

const layoutAndDensity = [
	backgroundPattern,
	borderRadius,
	budgetTableRowHeight,
	reportWidgetBackgroundColor,
	sidebarAccountSpacing,
	toggleColumns,
	resizableTransactionColumns,
	hideMonthOnScroll,
];

const readability = [
	colorNegativeBalances,
	colorTransactions,
	dimReconciled,
	notificationContrast,
	showDailyAvailable,
	headerBorder,
	reportCardBorders,
	budgetPageBorders,
];

const appearance = [sidebarRedesign, sidebarIcons, accountIconPicker, imageWidgets];

const workflows = [categoryTemplateInsights, templateApplyBreakdown];

export const coreScripts = [sidePanel, scheduleHighlight];

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
		colorNegativeBalances,
		colorTransactions,
		dimReconciled,
		hideMonthOnScroll,
		notificationContrast,
		resizableTransactionColumns,
		showDailyAvailable,
		sidebarRedesign,
		sidebarIcons,
		accountIconPicker,
		imageWidgets,
		categoryTemplateInsights,
		templateApplyBreakdown,
		headerBorder,
		reportCardBorders,
		budgetPageBorders,
		themeLoader,
	],
];
