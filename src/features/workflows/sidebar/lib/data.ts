import type { Account, Transaction } from "@lib/types/actual-schema";
import { calculate, dispatch, query, send } from "@lib/actual/actual-api";
import { readCell } from "@lib/actual/budget-cells";
import { findUncategorizedButton } from "@lib/actual/native-ui";
import {
	ACCOUNT_BALANCE_CELL,
	ACCOUNT_BALANCE_PREFIX,
	ACCOUNT_LINK,
	CELL,
	GRID_ROW,
} from "@lib/actual-dom";

export type SyncStatus = "synced" | "syncing" | "error" | "manual";

export interface SidebarAccount {
	id: string;
	name: string;
	offbudget: boolean;
	closed: boolean;
	balance: number;
	uncategorized: number;
	status: SyncStatus;
}

// sync_status is one of loot-core's BankSyncStatus values for linked
// accounts, or unset for manual ones.
function toSyncStatus(syncStatus: string | null | undefined): SyncStatus {
	if (!syncStatus) {
		return "manual";
	}
	if (syncStatus === "ok") {
		return "synced";
	}
	if (syncStatus === "pending" || syncStatus === "sync-requested") {
		return "syncing";
	}
	return "error";
}

/**
 * An account's balance. Actual's sheet cell only exists while a native sidebar row shows the
 * account, which a collapsed group never does; without one, or before the sheet is ready, this
 * runs Actual's own balance query (bindings.accountBalance).
 */
async function loadBalance(accountId: string, hasRow = false): Promise<number | null> {
	if (hasRow) {
		const cell = await readCell("__global", `balance-${accountId}`);
		if (cell !== null) {
			return cell;
		}
	}
	try {
		return await calculate<number>(
			"transactions",
			{ $sum: "$amount" },
			{ filter: { account: accountId }, options: { splits: "none" } },
		);
	} catch {
		return null;
	}
}

/**
 * Loads real accounts plus their live balances. Uncategorized counts are
 * carried over from `previous` — fill them with `refreshUncategorizedCounts`,
 * which scans transactions and shouldn't block the first paint.
 */
export async function loadSidebarAccounts(
	previous: SidebarAccount[] = [],
): Promise<SidebarAccount[]> {
	const accounts = await query<
		(Pick<Account, "id" | "name" | "offbudget" | "closed" | "tombstone"> & {
			sync_status?: string | null;
			bank_sync_status?: string | null;
		})[]
	>("accounts");

	const prevUncategorized = new Map(previous.map((a) => [a.id, a.uncategorized]));
	const live = accounts.filter((a) => !a.tombstone);
	const withRows = readNativeBalanceCells();
	const balances = await Promise.all(live.map((a) => loadBalance(a.id, withRows.has(a.id))));

	return live.map((a, i) => ({
		id: a.id,
		name: a.name,
		offbudget: a.offbudget,
		closed: a.closed,
		balance: balances[i] ?? 0,
		uncategorized: prevUncategorized.get(a.id) ?? 0,
		status: toSyncStatus(a.sync_status ?? a.bank_sync_status),
	}));
}

/** Returns the ids whose balance changed, and those that couldn't be read to retry later. */
export async function refreshBalances(
	accounts: SidebarAccount[],
	/** Accounts drawn in the native sidebar, whose live cells hold their balances. */
	withRows: Set<string> = new Set(),
): Promise<{ changed: string[]; failed: string[] }> {
	const changed: string[] = [];
	const failed: string[] = [];
	if (!accounts.length) {
		return { changed, failed };
	}
	const balances = await Promise.all(accounts.map((a) => loadBalance(a.id, withRows.has(a.id))));
	accounts.forEach((account, i) => {
		const balance = balances[i];
		if (balance == null) {
			failed.push(account.id);
		} else if (balance !== account.balance) {
			account.balance = balance;
			changed.push(account.id);
		}
	});
	return { changed, failed };
}

// Re-polls just sync_status for these accounts (no push event exists for
// it) and updates status in place — kept narrow so it's cheap to call
// often. Returns ids whose status actually changed.
export async function refreshSyncStatuses(accounts: SidebarAccount[]): Promise<string[]> {
	if (!accounts.length) {
		return [];
	}

	// No explicit select: sync_status/bank_sync_status aren't real AQL fields
	// by name, only via the default select("*") expansion.
	const rows = await query<
		{
			id: string;
			sync_status?: string | null;
			bank_sync_status?: string | null;
		}[]
	>("accounts", {
		filter: { id: { $oneof: accounts.map((a) => a.id) } },
	});

	const statusById = new Map(
		rows.map((r) => [r.id, toSyncStatus(r.sync_status ?? r.bank_sync_status)]),
	);
	const changed: string[] = [];
	for (const account of accounts) {
		const next = statusById.get(account.id);
		if (next && next !== account.status) {
			account.status = next;
			changed.push(account.id);
		}
	}
	return changed;
}

/** Set on the hidden native sidebar's root by index.ts; scopes reads away from the rest of the page. */
export const NATIVE_ROOT_ATTR = "data-abt-native-sidebar-root";

/**
 * Native account balance cells keyed by account id, for both the classic sidebar (one `<a>`
 * per account) and the redesign (react-aria tree rows); the cell's name carries the id.
 */
function readNativeBalanceCells(): Map<string, HTMLElement> {
	const root = document.querySelector(`[${NATIVE_ROOT_ATTR}]`) ?? document;
	const cells = new Map<string, HTMLElement>();
	for (const cell of root.querySelectorAll<HTMLElement>(ACCOUNT_BALANCE_CELL)) {
		const id = cell.dataset.cellname?.slice(ACCOUNT_BALANCE_PREFIX.length);
		if (id && cell.closest(`${ACCOUNT_LINK}, ${GRID_ROW}`)) {
			cells.set(id, cell);
		}
	}
	return cells;
}

/** The native sidebar's totals (all, on and off budget, groups), which still show when groups collapse. */
export function readNativeTotalsText(): string {
	// Not the whole document, whose budget table is full of cells.
	const root = document.querySelector(`[${NATIVE_ROOT_ATTR}]`);
	if (!root) {
		return "";
	}
	return [...root.querySelectorAll<HTMLElement>(CELL)]
		.filter((el) => !el.dataset.cellname?.startsWith(ACCOUNT_BALANCE_PREFIX))
		.map((el) => `${el.dataset.cellname}=${el.textContent}`)
		.join("|");
}

// Balance cell is spreadsheet-bound and re-renders on its own on sync/tx changes.
export function readNativeAccountBalanceTexts(): Map<string, string> {
	const texts = new Map<string, string>();
	for (const [id, cell] of readNativeBalanceCells()) {
		if (cell.textContent) {
			texts.set(id, cell.textContent);
		}
	}
	return texts;
}

// Reads the native "N uncategorized transactions" button's text, if
// present — there's no push event for (un)categorizing a transaction, so
// comparing this against its last-seen value (see Sidebar.svelte) is the
// only way to detect it outside of a bank sync completing.
export function readNativeUncategorizedButtonText(): string {
	return findUncategorizedButton()?.textContent?.trim() ?? "";
}

// Re-reads uncategorized counts for just these accounts — same narrow-
// recheck shape as refreshSyncStatuses, but for the uncategorized badge.
// Returns ids whose count actually changed.
export async function refreshUncategorizedCounts(accounts: SidebarAccount[]): Promise<string[]> {
	if (!accounts.length) {
		return [];
	}

	const onBudget = accounts.filter((a) => !a.offbudget).map((a) => a.id);
	// Filtered in the query: a 10-year budget has tens of thousands of transactions to ship over the bridge.
	const txs = !onBudget.length
		? []
		: await query<Pick<Transaction, "account">[]>("transactions", {
				// Actual's own uncategorizedTransactions(): split lines rather than their parents, and
				// transfers only when they leave the budget.
				filter: {
					account: { $oneof: onBudget },
					category: null,
					$or: [{ "payee.transfer_acct.offbudget": true, "payee.transfer_acct": null }],
				},
				select: ["account"],
			});

	const counts = new Map<string, number>();
	for (const tx of txs) {
		counts.set(tx.account, (counts.get(tx.account) || 0) + 1);
	}

	const changed: string[] = [];
	for (const account of accounts) {
		const next = account.offbudget ? 0 : counts.get(account.id) || 0;
		if (next !== account.uncategorized) {
			account.uncategorized = next;
			changed.push(account.id);
		}
	}
	return changed;
}

// Same direct RPC Actual's own sidebar inline-edit uses. The server handler
// only reads id/name/last_reconciled, so this minimal payload is enough.
export async function renameAccount(id: string, name: string): Promise<void> {
	await send("account-update", { id, name });
}

// Opens Actual's real "Close account" modal (via the same
// account-properties → pushModal flow the native menu uses) rather than
// reimplementing its balance-transfer/category prompts.
export async function closeAccount(accountId: string): Promise<void> {
	const [account] = await query<Account[]>("accounts", {
		filter: { id: accountId },
	});
	if (!account) {
		return;
	}

	const props = await send<{ balance: number; numTransactions: number }>("account-properties", {
		id: accountId,
	});
	await dispatch("pushModal", {
		modal: {
			name: "close-account",
			options: {
				account,
				balance: props.balance,
				canDelete: props.numTransactions === 0,
			},
		},
	});
}

interface BankSyncResult {
	errors?: { type?: string; category?: string; code?: string; message: string }[];
	newTransactions?: string[];
	matchedTransactions?: string[];
	updatedAccounts?: string[];
}

// Per-account bank sync, the same "accounts-bank-sync" RPC and Redux follow-up as the native
// sync (accounts/mutations.ts's syncAccounts and handleSyncResponse): failed/success marks,
// error toasts, then the new, matched and updated ids, which Actual's "new" styling and the
// sync recap read. Its React Query invalidation is left out; this sidebar reloads its own data.
export async function syncAllAccounts(accounts: SidebarAccount[]): Promise<void> {
	const ids = accounts.filter((a) => a.status !== "manual" && !a.closed).map((a) => a.id);
	if (!ids.length) {
		return;
	}
	const added: string[] = [];
	const matched: string[] = [];
	const updated: string[] = [];
	await dispatch("setAccountsSyncing", { ids });
	try {
		await syncEach(ids, added, matched, updated);
		await dispatch("setNewTransactions", { newTransactions: added, matchedTransactions: matched });
		await dispatch("markUpdatedAccounts", { ids: updated });
	} finally {
		// Always, or the sync spinner would stay on if a follow-up dispatch failed.
		await dispatch("setAccountsSyncing", { ids: [] });
	}
}

async function syncEach(
	ids: string[],
	added: string[],
	matched: string[],
	updated: string[],
): Promise<void> {
	for (const id of ids) {
		try {
			const res = await send<BankSyncResult>("accounts-bank-sync", { ids: [id] });
			const errors = res?.errors ?? [];
			const syncError = errors.find((e) => e.type === "SyncError");
			if (syncError) {
				await dispatch("markAccountFailed", {
					id,
					errorType: syncError.category,
					errorCode: syncError.code,
				});
			} else if (!errors.length) {
				await dispatch("markAccountSuccess", { id });
			}
			for (const error of errors) {
				await dispatch("addNotification", {
					notification: { type: "error", message: error.message },
				});
			}
			added.push(...(res?.newTransactions ?? []));
			matched.push(...(res?.matchedTransactions ?? []));
			updated.push(...(res?.updatedAccounts ?? []));
		} catch {
			// best-effort — one broken/unreachable account shouldn't block the rest
		}
	}
}
