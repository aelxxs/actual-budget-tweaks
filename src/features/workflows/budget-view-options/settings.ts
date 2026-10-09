import { categoryColorDots } from "@features/appearance/category-color-dots";
import { categoryEmojiPicker } from "@features/appearance/category-emoji-picker";
import { budgetTableRowHeight } from "@features/layout/budget-table-row-height";
import { hideMonthOnScroll } from "@features/layout/hide-month-on-scroll";
import { balancePills } from "@features/readability/balance-pills";
import { budgetCardStyling } from "@features/readability/budget-card-styling";
import { budgetPageBorders } from "@features/readability/budget-page-borders";
import { budgetTotalsLabelStyling } from "@features/readability/budget-totals-label-styling";
import { categoryProgress } from "@features/readability/category-progress";
import { showDailyAvailable } from "@features/readability/show-daily-available";
import type { Setting } from "@features/types";
import { budgetCategoryFilter } from "@features/workflows/budget-category-filter";
import { budgetMonthHeader } from "@features/workflows/budget-month-header";
import { budgetSummaryRow } from "@features/workflows/budget-summary-row";
import { categoryTemplateInsights } from "@features/workflows/category-template-insights";
import { hideFundedTemplateBars } from "@features/workflows/category-template-insights/hide-funded";
import { templatePlan } from "@features/workflows/template-plan";
import { nextMonthCoverageMethod } from "@features/workflows/template-plan/coverage-method";
import SettingsDialog, { type SettingsTab } from "@lib/components/SettingsDialog.svelte";
import { openDialog } from "@lib/utilities/dialog";

/** Every setting that changes the budget page, in one dialog opened from the page itself. */
export function openBudgetSettings(): void {
	// Built on open, not at import: several of these modules import this one back.
	const tabs: SettingsTab[] = [
		{
			value: "categories",
			label: "Categories",
			groups: [
				{
					heading: "On each category",
					settings: [
						categoryTemplateInsights,
						hideFundedTemplateBars,
						categoryProgress,
						balancePills,
					] as Setting[],
				},
				{
					heading: "Colors & icons",
					settings: [categoryColorDots, categoryEmojiPicker] as Setting[],
				},
			],
		},
		{
			value: "layout",
			label: "Layout",
			groups: [
				{
					heading: "Table",
					settings: [budgetTableRowHeight, budgetPageBorders, hideMonthOnScroll] as Setting[],
				},
				{
					heading: "Summary",
					settings: [budgetCardStyling, budgetTotalsLabelStyling, showDailyAvailable] as Setting[],
				},
			],
		},
		{
			value: "insights",
			label: "Insights",
			groups: [{ settings: [templatePlan, nextMonthCoverageMethod] as Setting[] }],
		},
		{
			value: "experimental",
			label: "Experimental",
			groups: [
				{ settings: [budgetMonthHeader, budgetSummaryRow, budgetCategoryFilter] as Setting[] },
			],
		},
	];

	openDialog("budget-settings", SettingsDialog, { title: "Budget settings", tabs });
}
