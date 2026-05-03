import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

const RECONCILED_ROW = '[data-testid="row"]:has([data-testid="cleared"] svg[viewBox="0 0 20 20"])';
const DIMMED_CELLS = ["date", "account", "payee", "notes", "category", "payment", "deposit", "debit", "credit"]
	.map((id) => `${RECONCILED_ROW} [data-testid="${id}"]`)
	.join(",\n\t\t\t");

export const dimReconciled = defineSetting({
	type: "checkbox",
	label: "Dim Reconciled Transactions",
	context: {
		key: "dim-reconciled",
		defaultValue: true,
		css: `
			${DIMMED_CELLS} {
				opacity: 0.45;
			}
		`,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled) applyGlobalCSS(ctx.css, ctx.key);
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		applyGlobalCSS(value ? ctx.css : "", ctx.key);
	},
});
