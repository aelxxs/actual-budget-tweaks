import { defineSetting } from "@features/types";
import { ACCOUNT_BALANCE } from "@lib/actual-dom";
import { findAccountToolbar } from "@lib/actual/native-ui";
import { currentAccountId } from "@lib/actual/pages";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import { type LoanStatus, loanStatus, onLoanSaved } from "./data";
import { closePanel, destroyPanel, panelWasClosed } from "./panel";
import PayoffButton from "./PayoffButton.svelte";
import PayoffSummary from "./PayoffSummary.svelte";

/*
 * On an account that owes money, or whose note has a `loan:` line: a Payoff button in the
 * toolbar, and beside the balance, where the saved plan ends. Both open a side panel that works
 * the plan out; the only thing it writes is that note line.
 */
const OURS = "data-abt-loan-payoff";

let active = false;
let button: (Mounted & { accountId: string }) | null = null;
let summary: (Mounted & { accountId: string }) | null = null;
// What the open account's note and balance say takes a query, so it's kept until the account
// changes or its settings are saved.
let checked: { accountId: string; status: LoanStatus | null } | null = null;

function teardown() {
	button?.destroy();
	button = null;
	summary?.destroy();
	summary = null;
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
	button = { ...mountToNodeWithReturn(PayoffButton, { accountId }), accountId };
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
	summary = {
		...mountToNodeWithReturn(PayoffSummary, { accountId, payoff: status.payoff }),
		accountId,
	};
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
		if (button || summary) {
			closePanel();
			teardown();
		}
		return;
	}
	if ((button ?? summary) && (button ?? summary)?.accountId !== accountId) {
		closePanel();
		teardown();
	}
	if (checked?.accountId !== accountId) {
		check(accountId);
		return;
	}
	if (!checked.status?.loan) {
		return;
	}
	placeButton(accountId);
	placeSummary(accountId, checked.status);
}

/** The saved plan changed, so the summary is redrawn from it. */
function refresh() {
	const accountId = currentAccountId();
	if (!active || !accountId) {
		return;
	}
	summary?.destroy();
	summary = null;
	check(accountId);
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
		"Saves the loan's rate and payment as one line in the account's note when you press Save.",
	context: {
		key: "loan-payoff",
		defaultValue: false,
	},
	init: () => {
		active = true;
		sync();
		const stop = watchDom(sync);
		const stopSaved = onLoanSaved(refresh);
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
