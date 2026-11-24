import { defineSetting } from "@features/types";
import { findAccountToolbar } from "@lib/actual/native-ui";
import { currentAccountId } from "@lib/actual/pages";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import { isLoan } from "./data";
import { closePanel, destroyPanel, panelWasClosed } from "./panel";
import PayoffButton from "./PayoffButton.svelte";

/*
 * A Payoff button on an account that owes money, or whose note has a `loan:` line. It opens a
 * side panel that works out when the debt clears; the only thing it writes is that note line.
 */
const OURS = "data-abt-loan-payoff";

let active = false;
let mounted: (Mounted & { accountId: string }) | null = null;
// Whether the open account is a loan takes a query, so the answer is kept until the account changes.
let checked: { accountId: string; loan: boolean | null } | null = null;

function teardown() {
	mounted?.destroy();
	mounted = null;
}

function check(accountId: string) {
	const mine = { accountId, loan: null as boolean | null };
	checked = mine;
	void isLoan(accountId)
		.catch(() => false)
		.then((loan) => {
			if (checked === mine && active) {
				mine.loan = loan;
				sync();
			}
		});
}

function sync() {
	if (panelWasClosed()) {
		destroyPanel();
	}

	const accountId = currentAccountId();
	if (!accountId) {
		checked = null;
		if (mounted) {
			closePanel();
			teardown();
		}
		return;
	}
	// Runs on every DOM change: nothing to do while the button is in place.
	if (mounted?.accountId === accountId && mounted.node.isConnected) {
		return;
	}
	if (mounted && mounted.accountId !== accountId) {
		closePanel();
		teardown();
	}
	if (checked?.accountId !== accountId) {
		check(accountId);
		return;
	}
	if (!checked.loan) {
		return;
	}
	const toolbar = findAccountToolbar();
	if (!toolbar) {
		return;
	}

	teardown();
	const button = mountToNodeWithReturn(PayoffButton, { accountId });
	button.node.setAttribute(OURS, "");
	// With the actions, before Actual's empty flex spacer.
	const spacer = [...toolbar.children].find((c) => c.matches(":empty"));
	if (spacer) {
		spacer.before(button.node);
	} else {
		toolbar.append(button.node);
	}
	mounted = { ...button, accountId };
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
		return () => {
			active = false;
			stop();
			checked = null;
			closePanel();
			teardown();
		};
	},
});
