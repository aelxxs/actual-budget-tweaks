import { calculate, query, refetchTransactions, send } from "@lib/actual/actual-api";
import { TRANSACTION_TABLE } from "@lib/actual-dom";
import { loadCurrency } from "@lib/format/currency";
import { isoDate } from "@lib/format/months";
import { numberPrefs } from "@lib/format/number-format.svelte";
import { type LedgerRow, type LoanTerms, type Payoff, accruedInterest, payoff } from "./amortize";
import { type LoanConfig, readLoan, removeLoan as removeLoanLine, writeLoan } from "./note";

export interface Loan {
	/** As Actual keeps it: negative while money is owed. */
	balance: number;
	/** Null until its settings have been saved to the note. */
	config: LoanConfig | null;
}

export interface LedgerEntry {
	date: string;
	amount: number;
	payee: string | null;
}

// Where Actual keeps an account's note.
const noteId = (accountId: string): string => `account-${accountId}`;

async function readNote(accountId: string): Promise<string | null> {
	const rows = await query<{ id: string; note: string | null }[]>("notes", {
		filter: { id: noteId(accountId) },
	});
	return rows?.[0]?.note ?? null;
}

export async function loadLoan(accountId: string): Promise<Loan> {
	const [balance, note] = await Promise.all([
		calculate<number>(
			"transactions",
			{ $sum: "$amount" },
			{ filter: { account: accountId }, options: { splits: "none" } },
		),
		readNote(accountId),
	]);
	return { balance: balance ?? 0, config: readLoan(note) };
}

/** The note's settings as terms to run, or null while any of them is missing. */
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
	/** Whether the account gets a Payoff button: it owes money, or its note already has a loan line. */
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

const savedListeners = new Set<() => void>();

/** Calls back after a loan's settings are saved to its note. */
export function onLoanSaved(listener: () => void): () => void {
	savedListeners.add(listener);
	return () => savedListeners.delete(listener);
}

/** Writes the settings to the account's note. The note is read again first, in case it changed. */
export async function saveLoan(accountId: string, config: LoanConfig): Promise<void> {
	const note = await readNote(accountId);
	await send("notes-save", { id: noteId(accountId), note: writeLoan(note, config) });
	for (const listener of savedListeners) {
		listener();
	}
}

/** Takes the settings back out of the account's note. */
export async function removeLoan(accountId: string): Promise<void> {
	const note = await readNote(accountId);
	if (note != null) {
		await send("notes-save", { id: noteId(accountId), note: removeLoanLine(note) });
	}
	for (const listener of savedListeners) {
		listener();
	}
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
		select: ["date", "amount", { payee: "payee.name" }],
		options: { splits: "none" },
	});
	return (rows ?? []).sort((a, b) => a.date.localeCompare(b.date));
}
