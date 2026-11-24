import { calculate, query, refetchTransactions, send } from "@lib/actual/actual-api";
import { TRANSACTION_TABLE } from "@lib/actual-dom";
import { loadCurrency } from "@lib/format/currency";
import { isoDate, isoDaysAgo } from "@lib/format/months";
import { numberPrefs } from "@lib/format/number-format.svelte";
import { type LoanTerms, type Payoff, payoff } from "./amortize";
import { type LoanConfig, readLoan, removeLoan as removeLoanLine, writeLoan } from "./note";

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

export interface Debt {
	id: string;
	name: string;
	owed: number;
	/** Null when its saved payment never clears it. */
	payoff: Payoff | null;
}

/** Every open account that owes money and has a complete saved plan, soonest paid off first. */
export async function loadDebts(): Promise<Debt[]> {
	const [notes, accounts] = await Promise.all([
		// Every note: Actual's query language can't match part of an id.
		query<{ id: string; note: string | null }[]>("notes"),
		query<{ id: string; name: string }[]>("accounts", {
			filter: { closed: false },
			select: ["id", "name"],
		}),
		loadCurrency(),
	]);
	const today = isoDate();
	const debts = await Promise.all(
		(accounts ?? []).map(async (account): Promise<Debt | null> => {
			const note = notes?.find((n) => n.id === noteId(account.id))?.note;
			const terms = termsOf(readLoan(note));
			if (!terms) {
				return null;
			}
			const balance = await calculate<number>(
				"transactions",
				{ $sum: "$amount" },
				{ filter: { account: account.id }, options: { splits: "none" } },
			);
			const owed = -(balance ?? 0);
			return owed > 0
				? { id: account.id, name: account.name, owed, payoff: payoff(owed, terms, today) }
				: null;
		}),
	);
	return debts
		.filter((debt): debt is Debt => debt != null)
		.sort((a, b) => (a.payoff?.month ?? "9999").localeCompare(b.payoff?.month ?? "9999"));
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

/** The account's recent transactions, oldest first, for working out the rate it was charged. */
export async function loadLedger(accountId: string): Promise<LedgerEntry[]> {
	const rows = await query<LedgerEntry[]>("transactions", {
		filter: { account: accountId, date: { $gte: isoDaysAgo(LEDGER_DAYS) } },
		select: ["date", "amount", { payee: "payee.name" }],
		options: { splits: "none" },
	});
	return (rows ?? []).sort((a, b) => a.date.localeCompare(b.date));
}
