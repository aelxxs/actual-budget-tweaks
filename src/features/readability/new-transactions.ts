import { watchDom } from "@lib/dom/dom-watcher";
import { Page, matchesPage } from "@lib/actual/pages";
import { byTestId } from "@lib/actual-dom";

const NEW_ATTR = "data-abt-tx-new";
const VALUE_CELLS = ["date", "account", "payee", "notes", "category", "debit", "credit"]
	.map((id) => `${byTestId(id)} > div`)
	.join(", ");

// The bridge reads Actual's own `added` flag for each row, which content scripts can't see.
function markRows(): void {
	if (matchesPage(Page.Accounts)) {
		document.dispatchEvent(new CustomEvent("abt:api:mark-new-rows"));
	}
}

export const NEW_TRANSACTION_CSS = `
	[${NEW_ATTR}] :is(${VALUE_CELLS}) {
		font-weight: inherit !important;
		color: inherit !important;
	}
	[${NEW_ATTR}] {
		box-shadow: inset 3px 0 0 var(--abt-accent);
	}
`;

export function startNewTransactions(): () => void {
	const unwatch = watchDom(markRows);
	document.addEventListener("abt:api:new-rows-changed", markRows);
	return () => {
		unwatch();
		document.removeEventListener("abt:api:new-rows-changed", markRows);
		document.querySelectorAll(`[${NEW_ATTR}]`).forEach((el) => el.removeAttribute(NEW_ATTR));
	};
}
