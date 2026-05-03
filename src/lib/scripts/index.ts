import { backgroundPattern } from "./background-pattern";
import { borderRadius } from "./border-radius";
import { budgetTableRowHeight } from "./budget-table-row-height";
import { categoryTemplateInsights } from "./category-template-insights";
import { colorNegativeBalances } from "./color-negative-balances";
import { colorTransactions } from "./color-transactions";
import { dimReconciled } from "./dim-reconciled";
import { hideMonthOnScroll } from "./hide-month-on-scroll";
import { notificationContrast } from "./notification-contrast";
import { reportWidgetBackgroundColor } from "./report-widget-background-color";
import { showDailyAvailable } from "./show-daily-available";
import { sidebarRedesign } from "./sidebar-redesign";
import { templateApplyBreakdown } from "./template-apply-breakdown";
import { themeSelector } from "./theme";
import { toggleNotesColumn } from "./toggle-notes-column";

export const scripts = [
	themeSelector,
	[backgroundPattern, borderRadius, budgetTableRowHeight],
	[reportWidgetBackgroundColor, toggleNotesColumn],
	[colorNegativeBalances, colorTransactions, dimReconciled, hideMonthOnScroll, notificationContrast, showDailyAvailable, sidebarRedesign, categoryTemplateInsights, templateApplyBreakdown],
];
