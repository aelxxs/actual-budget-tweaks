import { defineSetting } from "@features/types";
import { BUDGET_TOTALS, ROW } from "@lib/actual-dom";
import { ROW_HEIGHT_OPTIONS } from "./options";
import RowHeightPicker from "./Picker.svelte";

export const budgetTableRowHeight = defineSetting({
	type: "select",
	label: "Budget row height",
	description: "Sets how tall each budget row is.",
	group: "Budget",
	icon: "rows",
	context: {
		key: "actual-slimmer-budgetrows",
		defaultValue: "2.25rem",
	},
	options: ROW_HEIGHT_OPTIONS,
	picker: RowHeightPicker,
	css: ({ value }) => `
		:root {
			--abt-budget-row-height: ${value};
		}
		div${BUDGET_TOTALS} + div div${ROW} {
			height: ${value};
			flex: 0 0 ${value};
		}
	`,
});
