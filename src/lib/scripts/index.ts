import { backgroundPattern } from "./background-pattern";
import { borderRadius } from "./border-radius";
import { budgetTableRowHeight } from "./budget-table-row-height";
import { colorNegativeBalances } from "./color-negative-balances";
import { colorTransactions } from "./color-transactions";
import { hideMonthOnScroll } from "./hide-month-on-scroll";
import { reportWidgetBackgroundColor } from "./report-widget-background-color";
import { showDailyAvailable } from "./show-daily-available";
import { sidebarRedesign } from "./sidebar-redesign";
import { themeSelector } from "./theme";
import { toggleNotesColumn } from "./toggle-notes-column";

export const scripts = [
	themeSelector,
	[backgroundPattern, borderRadius, budgetTableRowHeight],
	[reportWidgetBackgroundColor, toggleNotesColumn],
	[colorNegativeBalances, colorTransactions, hideMonthOnScroll, showDailyAvailable, sidebarRedesign],
];
