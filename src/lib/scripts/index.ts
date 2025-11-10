import { backgroundPattern } from "./background-pattern";
import { borderRadius } from "./border-radius";
import { budgetTableRowHeight } from "./buget-table-row-height";
import { colorNegativeBalances } from "./color-negative-balances";
import { colorTransactions } from "./color-transactions";
import { hideMonthOnScroll } from "./hide-month-on-scroll";
import { imageWidgets } from "./image-widgets";
import { modernSidebarStates } from "./modern-sidebar-states";
import { reportWidgetBackgroundColor } from "./report-widget-background-color";
import { showDailyAvailable } from "./show-daily-available";
import { sidebarRedesign } from "./sidebar-redesign";
import { themeSelector } from "./theme";
import { toggleNotesColumn } from "./toggle-notes-column";
import { Setting } from "./types";

export const scripts: Setting[] = [
	backgroundPattern,
	borderRadius,
	budgetTableRowHeight,
	colorNegativeBalances,
	colorTransactions,
	hideMonthOnScroll,
	imageWidgets,
	modernSidebarStates,
	reportWidgetBackgroundColor,
	showDailyAvailable,
	sidebarRedesign,
	themeSelector,
	toggleNotesColumn,
];
