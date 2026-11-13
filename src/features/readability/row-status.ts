import { defineSetting } from "@features/types";
import { DIM_RECONCILED_CSS, startDimReconciled } from "./dim-reconciled";
import { UNCATEGORIZED_CSS, startHighlightUncategorized } from "./highlight-uncategorized";
import { NEW_TRANSACTION_CSS, startNewTransactions } from "./new-transactions";
import RowStatusPreview from "./previews/RowStatus.svelte";

export const rowStatus = defineSetting({
	type: "checkbox",
	label: "Row Status",
	description: "Marks new, uncategorized and reconciled transactions.",
	group: "Transactions",
	icon: "star",
	preview: RowStatusPreview,
	context: {
		key: "row-status",
		defaultValue: true,
	},
	css: () => DIM_RECONCILED_CSS + UNCATEGORIZED_CSS + NEW_TRANSACTION_CSS,
	init: () => {
		const stops = [startDimReconciled(), startHighlightUncategorized(), startNewTransactions()];
		return () => {
			for (const stop of stops) {
				stop();
			}
		};
	},
});
