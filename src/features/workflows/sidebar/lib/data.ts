import type { Account, Transaction } from "@lib/types/actual-schema";
import { dispatch, query, send } from "@lib/utilities/actual-api";
import { readCell } from "@lib/utilities/budget-cells";
import { findUncategorizedButton } from "@lib/utilities/native-ui";

export type SyncStatus = "synced" | "syncing" | "error" | "manual";

export interface SidebarAccount {
	id: string;
	name: string;
	type: Account["type"];
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

// Mirrors the native sidebar's own `get-cell` lookup rather than summing
// transactions ourselves. Null when the sheet isn't ready yet, as just after a load.
async function loadBalance(accountId: string): Promise<number | null> {
	return readCell("__global", `balance-${accountId}`);
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
		(Pick<Account, "id" | "name" | "type" | "offbudget" | "closed" | "tombstone"> & {
			sync_status?: string | null;
			bank_sync_status?: string | null;
		})[]
	>("accounts");

	const prevUncategorized = new Map(previous.map((a) => [a.id, a.uncategorized]));
	const live = accounts.filter((a) => !a.tombstone);
	const balances = await Promise.all(live.map((a) => loadBalance(a.id)));

	return live.map((a, i) => ({
		id: a.id,
		name: a.name,
		type: a.type,
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
): Promise<{ changed: string[]; failed: string[] }> {
	const changed: string[] = [];
	const failed: string[] = [];
	if (!accounts.length) {
		return { changed, failed };
	}
	const balances = await Promise.all(accounts.map((a) => loadBalance(a.id)));
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

const PENDING_DOT_VAR = "var(--color-sidebarItemBackgroundPending)";

/** Set on the hidden native sidebar's root by index.ts; scopes reads away from the rest of the page. */
export const NATIVE_ROOT_ATTR = "data-abt-native-sidebar-root";
const BALANCE_CELL_PREFIX = "__global!balance-";
/** The redesigned sidebar's SyncDot title while an account syncs (ABT is English-only). */
const REDESIGN_SYNCING_TITLE = "Syncing";

interface NativeAccountRow {
	row: HTMLElement;
	balance: HTMLElement;
}

/**
 * Native account rows keyed by account id, for both the classic sidebar (one `<a>`
 * per account) and the redesign (react-aria tree rows). Both render the balance
 * through the same spreadsheet cell, whose name carries the id.
 */
function readNativeAccountRows(): Map<string, NativeAccountRow> {
	const root = document.querySelector(`[${NATIVE_ROOT_ATTR}]`) ?? document;
	const rows = new Map<string, NativeAccountRow>();
	for (const balance of root.querySelectorAll<HTMLElement>(
		`[data-cellname^="${BALANCE_CELL_PREFIX}"]`,
	)) {
		const id = balance.dataset.cellname?.slice(BALANCE_CELL_PREFIX.length);
		const row = balance.closest<HTMLElement>('a[href^="/accounts/"], [role="row"]');
		if (id && row) {
			rows.set(id, { row, balance });
		}
	}
	return rows;
}

// Maps Actual's emotion-generated classes (css-xxxx) to their literal
// background-color, read off the CSSOM rule (not resolved) so var(...)
// comes back as a reference string. Scoped to <style data-emotion> sheets
// to keep the scan cheap.
function collectDotStateColors(): Map<string, string> {
	const colors = new Map<string, string>();
	for (const sheet of document.styleSheets) {
		const owner = sheet.ownerNode;
		if (!(owner instanceof HTMLStyleElement) || !owner.hasAttribute("data-emotion")) {
			continue;
		}

		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue; // inaccessible (e.g. cross-origin) — skip
		}

		for (const rule of rules) {
			if (!(rule instanceof CSSStyleRule)) {
				continue;
			}
			// Only a bare single-class selector — the dot's own state class —
			// never a descendant selector like `.linkClass .dot` (that's the
			// *active-link override* rule, not the dot's own declared state).
			const match = rule.selectorText.trim().match(/^\.([\w-]+)$/);
			if (!match) {
				continue;
			}
			const bg = rule.style.backgroundColor;
			if (bg) {
				colors.set(match[1], bg);
			}
		}
	}
	return colors;
}

// Emotion class names hash their styles, so a class's color never changes: cache
// the map and rescan stylesheets only when an unseen class shows up.
let dotStateColors = new Map<string, string>();
/** Class sets with no color rule even after a rescan, so they don't trigger rescans forever. */
const unresolvedDotClasses = new Set<string>();

// Classic sidebar: each row's `.dot` gets a per-state emotion class rather than
// an inline style, and its *computed* color can't be
// trusted either — when the account is the active route, a higher-priority
// rule overrides the rendered color without touching `.dot`'s classList. So
// this reads the declared rule for whichever class is actually in the
// classList, which stays correct regardless of selection.
function isClassicDotPending(row: HTMLElement, pass: { rescanned: boolean }): boolean {
	const dot = row.querySelector<HTMLElement>(".dot");
	if (!dot) {
		return false;
	}
	const classes = [...dot.classList].filter((cls) => cls !== "dot");
	const lookup = () =>
		classes.map((cls) => dotStateColors.get(cls)).find((color) => color !== undefined);

	let ownColor = lookup();
	const signature = classes.join(" ");
	if (ownColor === undefined && !pass.rescanned && !unresolvedDotClasses.has(signature)) {
		pass.rescanned = true;
		dotStateColors = collectDotStateColors();
		ownColor = lookup();
		if (ownColor === undefined) {
			unresolvedDotClasses.add(signature);
		}
	}
	return ownColor === PENDING_DOT_VAR;
}

// Reads which accounts the hidden native sidebar shows as syncing.
export function readNativeSyncingAccountIds(): Set<string> {
	const pass = { rescanned: false };
	const ids = new Set<string>();
	for (const [id, { row }] of readNativeAccountRows()) {
		if (row.querySelector(`[title="${REDESIGN_SYNCING_TITLE}"]`)) {
			ids.add(id);
			continue;
		}
		if (isClassicDotPending(row, pass)) {
			ids.add(id);
		}
	}
	return ids;
}

// Balance cell is spreadsheet-bound and re-renders on its own on sync/tx changes.
export function readNativeAccountBalanceTexts(): Map<string, string> {
	const texts = new Map<string, string>();
	for (const [id, { balance }] of readNativeAccountRows()) {
		if (balance.textContent) {
			texts.set(id, balance.textContent);
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

	const txs = await query<
		Pick<Transaction, "account" | "category" | "is_parent" | "is_child" | "transfer_id">[]
	>("transactions", {
		filter: {
			tombstone: false,
			account: { $oneof: accounts.map((a) => a.id) },
		},
	});

	const counts = new Map<string, number>();
	for (const tx of txs) {
		if (!tx.account) {
			continue;
		}
		if (tx.category || tx.is_parent || tx.is_child || tx.transfer_id) {
			continue;
		}
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
