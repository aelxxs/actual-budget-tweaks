import {
	calculate,
	loadCurrentBudgetId,
	query,
	refetchTransactions,
	send,
} from "@lib/actual/actual-api";
import { followBudgetValue } from "@lib/actual/budget-value";
import { TRANSACTION_TABLE } from "@lib/actual-dom";
import { loadCurrency } from "@lib/format/currency";
import { isoDate } from "@lib/format/months";
import { numberPrefs } from "@lib/format/number-format.svelte";
import { getValue, setValue } from "@lib/store";
import { type LedgerRow, type LoanTerms, type Payoff, accruedInterest, payoff } from "./amortize";
import { type LoanConfig, toConfig } from "./config";

export interface Loan {
	/** As Actual keeps it: negative while money is owed. */
	balance: number;
	/** Null until its settings have been saved. */
	config: LoanConfig | null;
}

export interface LedgerEntry {
	date: string;
	amount: number;
	payee: string | null;
	/** The account's opening balance, which Actual flags when the account is made. */
	starting_balance_flag?: boolean;
}

/*
 * Every loan's settings, by account id. Kept per budget with ABT's other budget data, which
 * settings sync shares with everyone who opens the budget (see BUDGET_SCOPED there).
 */
const PLANS_KEY = "loan-payoff-plans";

async function plansKey(): Promise<string | null> {
	const budgetId = await loadCurrentBudgetId().catch(() => undefined);
	return budgetId ? `${PLANS_KEY}:${budgetId}` : null;
}

async function readPlans(key: string): Promise<Record<string, unknown>> {
	const stored = await getValue<unknown>(key, null);
	return typeof stored === "object" && stored !== null ? { ...stored } : {};
}

async function readConfig(accountId: string): Promise<LoanConfig | null> {
	const key = await plansKey();
	return key ? toConfig((await readPlans(key))[accountId]) : null;
}

/** Saves the plans as `change` leaves them. Read again first, in case another tab changed them. */
async function writePlans(change: (plans: Record<string, unknown>) => void): Promise<void> {
	const key = await plansKey();
	if (!key) {
		throw new Error("No budget is open");
	}
	const plans = await readPlans(key);
	change(plans);
	await setValue(key, plans);
}

export async function loadLoan(accountId: string): Promise<Loan> {
	const [balance, config] = await Promise.all([
		calculate<number>(
			"transactions",
			{ $sum: "$amount" },
			{ filter: { account: accountId }, options: { splits: "none" } },
		),
		readConfig(accountId),
	]);
	return { balance: balance ?? 0, config };
}

/** The saved settings as terms to run, or null while any of them is missing. */
function termsOf(config: LoanConfig | null): LoanTerms | null {
	if (
		!config ||
		config.rate == null ||
		!config.payment ||
		config.paymentDay == null ||
		config.interestDay == null
	) {
		return null;
	}
	return {
		rate: config.rate,
		dayCount: config.daycount ?? "act365",
		payment: Math.round(config.payment * numberPrefs.scale),
		paymentDay: config.paymentDay,
		interestDay: config.interestDay,
	};
}

/** The ledger with the charges under the interest payee picked out; none while it isn't named. */
export function markInterest(ledger: LedgerEntry[], payee: string | undefined): LedgerRow[] {
	const name = payee?.trim().toLowerCase();
	return ledger.map((e) => ({
		date: e.date,
		amount: e.amount,
		interest: !!name && (e.payee ?? "").toLowerCase() === name,
	}));
}

/**
 * The saved plan's terms, with the daily interest built up since the last posting so the plan
 * doesn't lose those days. Null while a setting is missing.
 */
export function planTerms(loan: Loan | null, ledger: LedgerEntry[]): LoanTerms | null {
	const terms = termsOf(loan?.config ?? null);
	if (!loan || !terms) {
		return null;
	}
	const rows = markInterest(ledger, loan.config?.interestPayee);
	return { ...terms, accrued: accruedInterest(loan.balance, rows, terms, isoDate()) };
}

export interface LoanStatus {
	/** Whether the account gets a Payoff button: it owes money, or has settings saved. */
	loan: boolean;
	/** Where the saved plan ends; null without one, or when its payment never clears the debt. */
	payoff: Payoff | null;
}

export async function loanStatus(accountId: string): Promise<LoanStatus> {
	const [loan] = await Promise.all([loadLoan(accountId), loadCurrency()]);
	// The ledger only where there's a plan to run: this is asked of every account that's opened.
	const terms = termsOf(loan.config) ? planTerms(loan, await loadLedger(accountId)) : null;
	return {
		loan: loan.balance < 0 || loan.config != null,
		payoff: terms ? payoff(-loan.balance, terms, isoDate()) : null,
	};
}

/**
 * Calls back when the open budget's loan settings change: saved or removed here, in another tab,
 * or arriving from another device.
 */
export function followLoans(listener: () => void): () => void {
	return followBudgetValue(PLANS_KEY, listener).stop;
}

export function saveLoan(accountId: string, config: LoanConfig): Promise<void> {
	return writePlans((plans) => {
		plans[accountId] = config;
	});
}

export function removeLoan(accountId: string): Promise<void> {
	return writePlans((plans) => {
		delete plans[accountId];
	});
}

/**
 * Calls back, once things settle, after the open account's transaction table changes: there's no
 * event for a transaction being added or edited, but the table re-renders its rows.
 */
export function watchTransactions(callback: () => void, delay = 400): () => void {
	const table = document.querySelector(TRANSACTION_TABLE);
	if (!table) {
		return () => {};
	}
	let timer: ReturnType<typeof setTimeout> | undefined;
	const observer = new MutationObserver(() => {
		clearTimeout(timer);
		timer = setTimeout(callback, delay);
	});
	observer.observe(table, { childList: true, subtree: true });
	return () => {
		observer.disconnect();
		clearTimeout(timer);
	};
}

/**
 * Adds an interest charge to the account, uncleared and run through rules so it's categorised
 * like the lender's own. `amount` is what's charged, as a positive number.
 */
export async function postInterest(
	accountId: string,
	date: string,
	amount: number,
	payeeName: string | undefined,
): Promise<void> {
	const name = payeeName?.trim().toLowerCase();
	const payees = name
		? await query<{ id: string; name: string | null }[]>("payees", { select: ["id", "name"] })
		: [];
	const payee = payees?.find((p) => p.name?.toLowerCase() === name)?.id;
	const transaction = await send("rules-run", {
		transaction: {
			id: crypto.randomUUID(),
			account: accountId,
			amount: -amount,
			date,
			...(payee ? { payee } : {}),
			cleared: false,
			notes: "Expected interest",
		},
	});
	await send("transactions-batch-update", { added: [transaction] });
	await refetchTransactions().catch(() => false);
}

/** The budget's payees by name, without the ones Actual keeps for transfers between accounts. */
export async function loadPayeeNames(): Promise<string[]> {
	const payees = await query<{ name: string | null; transfer_acct: string | null }[]>("payees", {
		select: ["name", "transfer_acct"],
	});
	const names = (payees ?? []).flatMap((p) => (p.name && !p.transfer_acct ? [p.name] : []));
	return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/**
 * Every transaction on the account, oldest first: the interest it's been charged comes from the
 * recent ones, and how far the debt has come down from all of them.
 */
export async function loadLedger(accountId: string): Promise<LedgerEntry[]> {
	const rows = await query<LedgerEntry[]>("transactions", {
		filter: { account: accountId },
		select: ["date", "amount", "starting_balance_flag", { payee: "payee.name" }],
		options: { splits: "none" },
	});
	return (rows ?? []).sort((a, b) => a.date.localeCompare(b.date));
}
