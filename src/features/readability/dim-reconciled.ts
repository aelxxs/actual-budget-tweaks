import { defineSetting } from "@features/types";

const RECONCILED_ROW = '[data-testid="row"]:has([data-testid="cleared"] svg[viewBox="0 0 20 20"])';
const DIMMED_CELLS = [
	"date",
	"account",
	"payee",
	"notes",
	"category",
	"payment",
	"deposit",
	"debit",
	"credit",
	"select",
	"balance",
	"cleared",
]
	.map((id) => `${RECONCILED_ROW} [data-testid="${id}"]`)
	.join(",\n\t\t\t");

export const dimReconciled = defineSetting({
	type: "checkbox",
	label: "Dim Reconciled Transactions",
	context: {
		key: "dim-reconciled",
		defaultValue: true,
	},
	css: () => `
		${DIMMED_CELLS} {
			opacity: 0.45;
		}
	`,
});
