import { defineSetting } from "@features/types";
import { ACCOUNT_BALANCE, TRANSACTION_TABLE } from "@lib/actual-dom";
import { findAccountToolbar } from "@lib/actual/native-ui";
import { currentAccountId } from "@lib/actual/pages";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import { type LoanStatus, loanStatus, onLoanSaved, watchTransactions } from "./data";
import { closePanel, destroyPanel, panelWasClosed } from "./panel";
import PayoffButton from "./PayoffButton.svelte";
import PayoffSummary from "./PayoffSummary.svelte";

/*
 * On an account that owes money, or whose note has a `loan:` line: a Payoff button in the
 * toolbar, and beside the balance, where the saved plan ends. Both open a side panel that works
 * the plan out. It writes that note line when the settings or a tried payment are saved, and an
 * interest transaction when asked for one.
 */
const OURS = "data-abt-loan-payoff";

let active = false;
let button: Mounted | null = null;
let summary: Mounted | null = null;
// What the open account's note and balance say takes a query, so it's kept until the account
// changes or its settings are saved.
let checked: { accountId: string; status: LoanStatus | null } | null = null;
// Follows the open account's transactions, which move the balance the plan starts from.
let watching: { table: Element | null; stop: () => void } | null = null;

function teardown() {
	button?.destroy();
	button = null;
	summary?.destroy();
	summary = null;
	watching?.stop();
	watching = null;
}

/** Asks again, and redraws the summary only if the answer moved. */
function recheck() {
	const mine = checked;
	if (!active || !mine?.status) {
		return;
	}
	void loanStatus(mine.accountId)
		.catch(() => null)
		.then((status) => {
			if (!status || checked !== mine || !active) {
				return;
			}
			const moved = JSON.stringify(status.payoff) !== JSON.stringify(mine.status?.payoff);
			mine.status = status;
			if (moved) {
				summary?.destroy();
				summary = null;
			}
			sync();
		});
}

function watchTable() {
	const table = document.querySelector(TRANSACTION_TABLE);
	if (watching?.table === table) {
		return;
	}
	watching?.stop();
	watching = { table, stop: watchTransactions(recheck) };
}

function check(accountId: string) {
	const mine = { accountId, status: null as LoanStatus | null };
	checked = mine;
	void loanStatus(accountId)
		.catch((): LoanStatus => ({ loan: false, payoff: null }))
		.then((status) => {
			if (checked === mine && active) {
				mine.status = status;
				sync();
			}
		});
}

function placeButton(accountId: string) {
	if (button?.node.isConnected) {
		return;
	}
	const toolbar = findAccountToolbar();
	if (!toolbar) {
		return;
	}
	button?.destroy();
	button = mountToNodeWithReturn(PayoffButton, { accountId });
	button.node.setAttribute(OURS, "");
	// With the actions, before Actual's empty flex spacer.
	const spacer = [...toolbar.children].find((c) => c.matches(":empty"));
	if (spacer) {
		spacer.before(button.node);
	} else {
		toolbar.append(button.node);
	}
}

function placeSummary(accountId: string, status: LoanStatus) {
	if (!status.payoff) {
		summary?.destroy();
		summary = null;
		return;
	}
	if (summary?.node.isConnected) {
		return;
	}
	// The row holding the balance and the details Actual shows beside it.
	const row = document.querySelector(ACCOUNT_BALANCE)?.parentElement;
	if (!row) {
		return;
	}
	summary?.destroy();
	summary = mountToNodeWithReturn(PayoffSummary, { accountId, payoff: status.payoff });
	summary.node.setAttribute(OURS, "");
	row.append(summary.node);
}

function sync() {
	if (panelWasClosed()) {
		destroyPanel();
	}

	const accountId = currentAccountId();
	if (!accountId) {
		checked = null;
		if (button || summary || watching) {
			closePanel();
			teardown();
		}
		return;
	}
	if (checked && checked.accountId !== accountId) {
		closePanel();
		teardown();
	}
	if (checked?.accountId !== accountId) {
		check(accountId);
		return;
	}
	if (!checked.status) {
		return;
	}
	// Watched on any account: one with nothing owed becomes a loan once it borrows.
	watchTable();
	if (!checked.status.loan) {
		button?.destroy();
		button = null;
		summary?.destroy();
		summary = null;
		return;
	}
	placeButton(accountId);
	placeSummary(accountId, checked.status);
}

export const loanPayoff = defineSetting({
	type: "checkbox",
	label: "Loan payoff",
	description:
		"Adds a Payoff button to accounts that owe money, showing when the debt clears and what it costs.",
	group: "Accounts",
	icon: "interest",
	experimental: true,
	writes:
		"Saves the loan's rate and payment as one line in the account's note when you save them or use a payment you tried, and adds an interest transaction when you ask for one.",
	guide: "/guides/loan-payoff",
	context: {
		key: "loan-payoff",
		defaultValue: false,
	},
	init: () => {
		active = true;
		sync();
		const stop = watchDom(sync);
		const stopSaved = onLoanSaved(recheck);
		return () => {
			active = false;
			stop();
			stopSaved();
			checked = null;
			closePanel();
			teardown();
		};
	},
});
