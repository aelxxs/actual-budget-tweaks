import type { Account, Payee, Schedule, Transaction } from "@lib/types/actual-schema";
import { query, send } from "@lib/utilities/actual-api";
import { formatDayMonth, loadDatePrefs } from "@lib/utilities/date-format.svelte";
import type { SyncStatus } from "./data";

export interface UpcomingItem {
	id: string;
	/** Pre-formatted display date, e.g. "Jul 22" — a label, not a currency amount. */
	date: string;
	payee: string;
	/** Signed cents. */
	amount: number;
}

export interface AccountDetail {
	/** Real linked-bank display name (`bankName`), or a manual-account label. */
	institution: string;
	/** Real `account.type`, formatted for display. */
	type: string;
	/** 30 real daily balance points (signed cents), oldest to newest, ending at the account's actual current balance. */
	points: number[];
	deltaAbs: number;
	deltaPct: number;
	/** Real `balanceCleared-<id>` sheet value (signed cents). */
	clearedBalance: number;
	unclearedCount: number;
	/** Real `balanceUncleared-<id>` sheet value (signed cents). */
	unclearedAmount: number;
	upcoming: UpcomingItem[];
	syncText: string;
}

const TYPE_LABEL: Record<Account["type"], string> = {
	checking: "Checking",
	savings: "Savings",
	credit: "Credit Card",
	investment: "Investment",
	mortgage: "Mortgage",
	debt: "Loan",
	other: "Account",
};

function relTime(iso: string | null | undefined): string {
	if (!iso) return "";
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "";
	const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins} min ago`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
	const days = Math.round(hours / 24);
	return `${days} day${days > 1 ? "s" : ""} ago`;
}

const TREND_DAYS = 30;
const TREND_WINDOW_DAYS = TREND_DAYS + 3; // small buffer, doesn't affect the 30 points returned

function isoDaysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().slice(0, 10);
}

function scheduleAmount(amount: Schedule["_amount"]): number {
	if (typeof amount === "number") return amount;
	if (amount && typeof amount === "object") return amount.num1;
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
	if (cached) return cached;
	const promise = computeAccountDetail(accountId, status, currentBalance);
	cache.set(accountId, promise);
	promise.catch(() => cache.delete(accountId));
	return promise;
}

export function invalidateAccountDetail(accountId: string): void {
	cache.delete(accountId);
}

async function computeAccountDetail(
	accountId: string,
	status: SyncStatus,
	currentBalance: number,
): Promise<AccountDetail> {
	const [, accounts, recentTxs, clearedCell, unclearedCell, schedules] = await Promise.all([
		loadDatePrefs(),
		query<Pick<Account, "id" | "type" | "bankName" | "last_sync">[]>("accounts", {
			filter: { id: accountId },
		}),
		query<Pick<Transaction, "date" | "amount" | "is_child" | "cleared">[]>("transactions", {
			filter: {
				account: accountId,
				tombstone: false,
				date: { $gte: isoDaysAgo(TREND_WINDOW_DAYS) },
			},
		}),
		send<{ value: number }>("get-cell", {
			sheetName: "__global",
			name: `balanceCleared-${accountId}`,
		}).catch(() => null),
		send<{ value: number }>("get-cell", {
			sheetName: "__global",
			name: `balanceUncleared-${accountId}`,
		}).catch(() => null),
		query<Schedule[]>("schedules"),
	]);

	const account = accounts[0];
	const institution = account?.bankName || (status === "manual" ? "Manual entry" : "Bank-linked");
	const type = account?.type ? TYPE_LABEL[account.type] : "Account";

	// ---- 30-day trend: work backward from the real current balance using
	// only real transaction amounts in the trailing window (excluding split
	// children, matching the real balance sheet cells' own `splits: 'none'`
	// semantics) — no need to fetch the account's entire transaction history
	// just to plot a 30-day sparkline. ----
	const netByDay = new Map<string, number>();
	for (const tx of recentTxs) {
		if (tx.is_child) continue;
		netByDay.set(tx.date, (netByDay.get(tx.date) ?? 0) + tx.amount);
	}
	const points: number[] = [];
	let running = currentBalance;
	for (let i = 0; i < TREND_DAYS; i++) {
		points.unshift(running);
		running -= netByDay.get(isoDaysAgo(i)) ?? 0;
	}
	const deltaAbs = points[TREND_DAYS - 1] - points[0];
	const deltaPct = points[0] !== 0 ? (deltaAbs / Math.abs(points[0])) * 100 : 0;

	// ---- cleared / uncleared ----
	// The balances themselves come from the same real sheet cells Actual's
	// own Reconcile screen reads; the count has no precomputed cell, so it's
	// counted over the same trailing window already fetched for the trend.
	const unclearedCount = recentTxs.filter((t) => !t.cleared && !t.is_child).length;
	const clearedBalance = clearedCell?.value ?? currentBalance;
	const unclearedAmount = unclearedCell?.value ?? 0;

	// ---- upcoming scheduled transactions ----
	const upcomingRaw = schedules
		.filter((s) => !s.tombstone && !s.completed && s._account === accountId && s.next_date)
		.sort((a, b) => (a.next_date! < b.next_date! ? -1 : 1))
		.slice(0, 3);

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
	}));

	const syncText =
		status === "syncing"
			? "Syncing…"
			: status === "error"
				? "Connection error"
				: status === "manual"
					? "Manual account · not bank-linked"
					: account?.last_sync
						? `Synced ${relTime(account.last_sync)}`
						: "Synced";

	return {
		institution,
		type,
		points,
		deltaAbs,
		deltaPct,
		clearedBalance,
		unclearedCount,
		unclearedAmount,
		upcoming,
		syncText,
	};
}
