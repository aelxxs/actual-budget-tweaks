import { NAV_BORDER_CSS } from "@features/layout/borders";
import { REPORTS_HEADER_CSS, startReportsHeader } from "@features/layout/reports-header";
import {
	TOTALS_LABEL_CSS,
	startTotalsLabels,
} from "@features/readability/budget-totals-label-styling";
import { defineSetting } from "@features/types";
import { MONTH_HEADER_CSS, startMonthHeader } from "@features/workflows/budget-month-header";

export const modernHeaders = defineSetting({
	type: "checkbox",
	label: "Modern headers",
	description: "Restyles the Budget and Reports page headers.",
	icon: "layout",
	group: "General",
	context: {
		// Month Header's key: it was off by default, unlike the reports header it now includes.
		key: "budget-month-header",
		defaultValue: false,
	},
	css: () => NAV_BORDER_CSS + MONTH_HEADER_CSS + TOTALS_LABEL_CSS + REPORTS_HEADER_CSS,
	init: () => {
		const stops = [startMonthHeader(), startTotalsLabels(), startReportsHeader()];
		return () => stops.forEach((stop) => stop());
	},
});
