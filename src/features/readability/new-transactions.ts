import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";

const NEW_ATTR = "data-abt-tx-new";
const VALUE_CELLS = ["date", "payee", "notes", "category", "debit", "credit"]
	.map((id) => `[data-testid="${id}"] > div`)
	.join(", ");

// The bridge reads Actual's own `added` flag for each row, which content scripts can't see.
function markRows(): void {
	if (matchesPage(Page.Accounts)) document.dispatchEvent(new CustomEvent("abt:api:mark-new-rows"));
}

export const newTransactionStyle = defineSetting({
	type: "checkbox",
	label: "Quiet New Transactions",
	description: "Mark newly imported transactions with an accent bar instead of bold colored text.",
	group: "Transactions",
	icon: "sparkles",
	context: {
		key: "new-transaction-style",
		defaultValue: true,
	},
	css: () => `
		[${NEW_ATTR}] :is(${VALUE_CELLS}) {
			font-weight: inherit !important;
			color: inherit !important;
		}
		[${NEW_ATTR}] {
			box-shadow: inset 3px 0 0 var(--abt-accent);
		}
	`,
	init: () => {
		const unwatch = watchDom(markRows);
		return () => {
			unwatch();
			document.querySelectorAll(`[${NEW_ATTR}]`).forEach((el) => el.removeAttribute(NEW_ATTR));
		};
	},
});
