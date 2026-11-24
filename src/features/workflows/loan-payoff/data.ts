import { calculate, query, send } from "@lib/actual/actual-api";
import { loadCurrency } from "@lib/format/currency";
import { isoDate, isoDaysAgo } from "@lib/format/months";
import { numberPrefs } from "@lib/format/number-format.svelte";
import { type LoanTerms, type Payoff, payoff } from "./amortize";
import { type LoanConfig, readLoan, writeLoan } from "./note";

/** Far enough back for a few interest postings, quarterly ones included. */
const LEDGER_DAYS = 400;

export interface Loan {
	name: string;
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

export async function loadLoan(accountId: string): Promise<Loan | null> {
	const [accounts, balance, note] = await Promise.all([
		query<{ id: string; name: string }[]>("accounts", {
			filter: { id: accountId },
			select: ["id", "name"],
		}),
		calculate<number>(
			"transactions",
			{ $sum: "$amount" },
			{ filter: { account: accountId }, options: { splits: "none" } },
		),
		readNote(accountId),
	]);
	const account = accounts?.[0];
	if (!account) {
		return null;
	}
	return { name: account.name, balance: balance ?? 0, config: readLoan(note) };
}

/** The note's settings as terms to run, or null while any of them is missing. */
export function termsOf(config: LoanConfig | null): LoanTerms | null {
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

export interface LoanStatus {
	/** Whether the account gets a Payoff button: it owes money, or its note already has a loan line. */
	loan: boolean;
	/** Where the saved plan ends; null without one, or when its payment never clears the debt. */
	payoff: Payoff | null;
}

export async function loanStatus(accountId: string): Promise<LoanStatus> {
	const [loan] = await Promise.all([loadLoan(accountId), loadCurrency()]);
	if (!loan) {
		return { loan: false, payoff: null };
	}
	const terms = termsOf(loan.config);
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

/** The account's recent transactions, oldest first, for working out the rate it was charged. */
export async function loadLedger(accountId: string): Promise<LedgerEntry[]> {
	const rows = await query<LedgerEntry[]>("transactions", {
		filter: { account: accountId, date: { $gte: isoDaysAgo(LEDGER_DAYS) } },
		select: ["date", "amount", { payee: "payee.name" }],
		options: { splits: "none" },
	});
	return (rows ?? []).sort((a, b) => a.date.localeCompare(b.date));
}
