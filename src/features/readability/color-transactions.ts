import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";

function colorUpcomingRows() {
	document.querySelectorAll('*[data-testid="row"]').forEach((row) => {
		const cat = row.querySelector('*[data-testid="category"]');
		if (!cat) return;
		const firstChild = cat.firstElementChild;
		if (firstChild && firstChild.textContent === "Upcoming") {
			const date = row.querySelector<HTMLElement>('*[data-testid="date"]');
			const account = row.querySelector<HTMLElement>('*[data-testid="account"]');
			const payee = row.querySelector<HTMLElement>('*[data-testid="payee"]');
			const notes = row.querySelector<HTMLElement>('*[data-testid="notes"]');
			if (date) date.style.color = "var(--ctp-peach)";
			if (account) account.style.color = "var(--ctp-peach)";
			if (payee) payee.style.color = "var(--ctp-peach)";
			if (notes) notes.style.color = "var(--ctp-peach)";
		}
	});
}

function cleanup() {
	document.querySelectorAll('*[data-testid="row"]').forEach((row) => {
		const date = row.querySelector<HTMLElement>('*[data-testid="date"]');
		const account = row.querySelector<HTMLElement>('*[data-testid="account"]');
		const payee = row.querySelector<HTMLElement>('*[data-testid="payee"]');
		const notes = row.querySelector<HTMLElement>('*[data-testid="notes"]');
		if (date) date.style.removeProperty("color");
		if (account) account.style.removeProperty("color");
		if (payee) payee.style.removeProperty("color");
		if (notes) notes.style.removeProperty("color");
	});
}

export const colorTransactions = defineSetting({
	type: "checkbox",
	label: "Color Transactions",
	context: {
		key: "actual-amountcolors",
		defaultValue: true,
	},
	css: () => `
		*[data-testid='credit'] {
			color: var(--color-noticeBackground) !important;
		}
		*[data-testid='debit'] {
			color: var(--color-errorText) !important;
		}
	`,
	init: () => {
		const unwatch = watchDom(colorUpcomingRows);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
