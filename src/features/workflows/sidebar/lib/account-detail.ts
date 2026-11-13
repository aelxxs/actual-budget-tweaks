import type { Account, Payee, Schedule, Transaction } from "@lib/types/actual-schema";
import { calculate, query } from "@lib/actual/actual-api";
import { formatDayMonth, loadDatePrefs } from "@lib/format/date-format.svelte";
import { isoDaysAgo } from "@lib/format/months";
import type { SyncStatus } from "./data";

export interface UpcomingItem {
	id: string;
	/** Pre-formatted display date, e.g. "Jul 22" — a label, not a currency amount. */
	date: string;
	payee: string;
	/** Signed cents. */
	amount: number;
	/** Its date has passed and it hasn't been entered yet. */
	overdue: boolean;
}

export interface AccountDetail {
	/** Linked bank's name, or "Bank-linked" / "Manual entry". */
	institution: string;
	/** "Synced 5m ago", "Syncing…", "Connection error"; empty for a manual account. */
	syncText: string;
	/** 30 daily balances (signed cents), oldest to newest, ending at the current balance. */
	points: number[];
	/** False when nothing moved in the window, e.g. a new account; the chart is left out. */
	hasActivity: boolean;
	deltaAbs: number;
	/** Every uncleared transaction's amount, summed (signed cents). */
	unclearedAmount: number;
	/** Overdue ones first, then the next few from today. */
	upcoming: UpcomingItem[];
}

function relTime(iso: string | null | undefined): string {
	const then = iso ? new Date(iso).getTime() : NaN;
	if (Number.isNaN(then)) {
		return "";
	}
	const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
	if (mins < 1) {
		return "just now";
	}
	if (mins < 60) {
		return `${mins}m ago`;
	}
	const hours = Math.round(mins / 60);
	return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const TREND_DAYS = 30;
const TREND_WINDOW_DAYS = TREND_DAYS + 3; // small buffer, doesn't affect the 30 points returned

function scheduleAmount(amount: Schedule["_amount"]): number {
	if (typeof amount === "number") {
		return amount;
	}
	if (amount && typeof amount === "object") {
		return amount.num1;
	}
	return 0;
}

// Keyed by account id, so re-hovering the same account after the first
// (real, multi-query) load is instant.
const cache = new Map<string, Promise<AccountDetail>>();

export function loadAccountDetail(
	accountId: string,
	status: SyncStatus,
	currentBalance: number,
): Promise<AccountDetail> {
	const cached = cache.get(accountId);
	if (cached) {
		return cached;
	}
	const promise = computeAccountDetail(accountId, status, currentBalance);
	cache.set(accountId, promise);
	promise.catch(() => cache.delete(accountId));
	return promise;
}

export function invalidateAccountDetail(accountId: string): void {
	cache.delete(accountId);
}

async function sumAmounts(account: string, cleared: boolean): Promise<number> {
	const sum = await calculate<number | null>(
		"transactions",
		{ $sum: "$amount" },
		{ filter: { account, cleared }, options: { splits: "none" } },
	);
	return sum ?? 0;
}

async function computeAccountDetail(
	accountId: string,
	status: SyncStatus,
	currentBalance: number,
): Promise<AccountDetail> {
	const [, accounts, recentTxs, unclearedAmount, schedules] = await Promise.all([
		loadDatePrefs(),
		query<Pick<Account, "id" | "bankName" | "last_sync">[]>("accounts", {
			filter: { id: accountId },
		}),
		query<Pick<Transaction, "date" | "amount" | "is_child">[]>("transactions", {
			filter: {
				account: accountId,
				tombstone: false,
				date: { $gte: isoDaysAgo(TREND_WINDOW_DAYS) },
			},
		}),
		// Actual's balanceUncleared cells stay empty until its own account page asks for them.
		sumAmounts(accountId, false),
		query<Schedule[]>("schedules"),
	]);

	const account = accounts[0];
	const institution = account?.bankName || (status === "manual" ? "Manual entry" : "Bank-linked");

	// ---- 30-day trend: work backward from the real current balance using
	// only real transaction amounts in the trailing window (excluding split
	// children, matching the real balance sheet cells' own `splits: 'none'`
	// semantics) — no need to fetch the account's entire transaction history
	// just to plot a 30-day sparkline. ----
	const netByDay = new Map<string, number>();
	for (const tx of recentTxs) {
		if (tx.is_child) {
			continue;
		}
		netByDay.set(tx.date, (netByDay.get(tx.date) ?? 0) + tx.amount);
	}
	const points: number[] = [];
	let running = currentBalance;
	for (let i = 0; i < TREND_DAYS; i++) {
		points.unshift(running);
		running -= netByDay.get(isoDaysAgo(i)) ?? 0;
	}
	const deltaAbs = points[TREND_DAYS - 1] - points[0];
	const hasActivity = netByDay.size > 0;

	// ---- upcoming scheduled transactions ----
	const upcomingRaw = schedules
		.filter((s) => !s.tombstone && !s.completed && s._account === accountId && s.next_date)
		.sort((a, b) => (a.next_date! < b.next_date! ? -1 : 1))
		.slice(0, 4);
	const today = isoDaysAgo(0);

	const payeeIds = [
		...new Set(upcomingRaw.map((s) => s._payee).filter((id): id is string => !!id)),
	];
	const payees = payeeIds.length
		? await query<Pick<Payee, "id" | "name">[]>("payees", { filter: { id: { $oneof: payeeIds } } })
		: [];
	const payeeName = new Map(payees.map((p) => [p.id, p.name]));

	const upcoming: UpcomingItem[] = upcomingRaw.map((s) => ({
		id: s.id,
		date: formatDayMonth(s.next_date!),
		payee: (s._payee && payeeName.get(s._payee)) || s.name || "Scheduled",
		amount: scheduleAmount(s._amount),
		overdue: s.next_date! < today,
	}));

	const syncText =
		status === "syncing"
			? "Syncing…"
			: status === "error"
				? "Connection error"
				: status === "manual"
					? ""
					: ["Synced", relTime(account?.last_sync)].filter(Boolean).join(" ");

	return {
		institution,
		syncText,
		points,
		hasActivity,
		deltaAbs,
		unclearedAmount,
		upcoming,
	};
}
