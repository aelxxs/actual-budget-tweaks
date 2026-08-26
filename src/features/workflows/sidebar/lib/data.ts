import type { Account, Transaction } from "@lib/types/actual-schema";
import { dispatch, query, send } from "@lib/utilities/actual-api";

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
	if (!syncStatus) return "manual";
	if (syncStatus === "ok") return "synced";
	if (syncStatus === "pending" || syncStatus === "sync-requested") return "syncing";
	return "error";
}

// Mirrors the native sidebar's own `get-cell` lookup rather than summing
// transactions ourselves.
async function loadBalance(accountId: string): Promise<number> {
	try {
		const cell = await send<{ value: number }>("get-cell", {
			sheetName: "__global",
			name: `balance-${accountId}`,
		});
		return typeof cell?.value === "number" ? cell.value : 0;
	} catch {
		return 0;
	}
}

/**
 * Loads real accounts plus their live balances and uncategorized-transaction
 * counts.
 */
export async function loadSidebarAccounts(): Promise<SidebarAccount[]> {
	const [accounts, txs] = await Promise.all([
		query<
			(Pick<Account, "id" | "name" | "type" | "offbudget" | "closed" | "tombstone"> & {
				sync_status?: string | null;
				bank_sync_status?: string | null;
			})[]
		>("accounts"),
		query<
			Pick<
				Transaction,
				"account" | "category" | "is_parent" | "is_child" | "transfer_id" | "tombstone"
			>[]
		>("transactions", { filter: { tombstone: false } }),
	]);

	console.debug("[ABT experimental sidebar] accounts ->", accounts);

	const uncategorized = new Map<string, number>();
	for (const tx of txs) {
		if (!tx.account) continue;
		if (tx.category || tx.is_parent || tx.is_child || tx.transfer_id) continue;
		uncategorized.set(tx.account, (uncategorized.get(tx.account) || 0) + 1);
	}

	const live = accounts.filter((a) => !a.tombstone);
	const balances = await Promise.all(live.map((a) => loadBalance(a.id)));

	return live.map((a, i) => ({
		id: a.id,
		name: a.name,
		type: a.type,
		offbudget: a.offbudget,
		closed: a.closed,
		balance: balances[i],
		uncategorized: a.offbudget ? 0 : uncategorized.get(a.id) || 0,
		status: toSyncStatus(a.sync_status ?? a.bank_sync_status),
	}));
}

export async function refreshBalances(accounts: SidebarAccount[]): Promise<string[]> {
	if (!accounts.length) return [];
	const balances = await Promise.all(accounts.map((a) => loadBalance(a.id)));
	const changed: string[] = [];
	accounts.forEach((account, i) => {
		if (balances[i] !== account.balance) {
			account.balance = balances[i];
			changed.push(account.id);
		}
	});
	return changed;
}

// Re-polls just sync_status for these accounts (no push event exists for
// it) and updates status in place — kept narrow so it's cheap to call
// often. Returns ids whose status actually changed.
export async function refreshSyncStatuses(accounts: SidebarAccount[]): Promise<string[]> {
	if (!accounts.length) return [];

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

// Maps Actual's emotion-generated classes (css-xxxx) to their literal
// background-color, read off the CSSOM rule (not resolved) so var(...)
// comes back as a reference string. Scoped to <style data-emotion> sheets
// to keep the scan cheap.
function collectDotStateColors(): Map<string, string> {
	const colors = new Map<string, string>();
	for (const sheet of document.styleSheets) {
		const owner = sheet.ownerNode;
		if (!(owner instanceof HTMLStyleElement) || !owner.hasAttribute("data-emotion")) continue;

		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue; // inaccessible (e.g. cross-origin) — skip
		}

		for (const rule of rules) {
			if (!(rule instanceof CSSStyleRule)) continue;
			// Only a bare single-class selector — the dot's own state class —
			// never a descendant selector like `.linkClass .dot` (that's the
			// *active-link override* rule, not the dot's own declared state).
			const match = rule.selectorText.trim().match(/^\.([\w-]+)$/);
			if (!match) continue;
			const bg = rule.style.backgroundColor;
			if (bg) colors.set(match[1], bg);
		}
	}
	return colors;
}

// Reads which accounts the hidden native sidebar shows as syncing. Each
// row's `.dot` gets a per-state emotion class (e.g. css-1c4utta) rather
// than an inline style, and its *computed* color can't be trusted either —
// when the account is the active route, a higher-priority rule overrides
// the rendered color without touching `.dot`'s classList. So this reads the
// declared rule for whichever class is actually in the classList, which
// stays correct regardless of selection.
export function readNativeSyncingAccountIds(): Set<string> {
	const dotStateColors = collectDotStateColors();
	const ids = new Set<string>();
	for (const link of document.querySelectorAll<HTMLAnchorElement>(
		'a[href^="/accounts/"][href*="-"]',
	)) {
		const dot = link.querySelector<HTMLElement>(".dot");
		if (!dot) continue;

		const ownColor = [...dot.classList]
			.filter((cls) => cls !== "dot")
			.map((cls) => dotStateColors.get(cls))
			.find((color) => color !== undefined);
		if (ownColor !== PENDING_DOT_VAR) continue;

		const id = link.getAttribute("href")?.split("/accounts/")[1];
		if (id) ids.add(id);
	}
	return ids;
}

// Balance cell is spreadsheet-bound and re-renders on its own on sync/tx changes.
export function readNativeAccountBalanceTexts(): Map<string, string> {
	const texts = new Map<string, string>();
	for (const link of document.querySelectorAll<HTMLAnchorElement>(
		'a[href^="/accounts/"][href*="-"]',
	)) {
		const id = link.getAttribute("href")?.split("/accounts/")[1];
		if (!id) continue;
		const cell = link.querySelector<HTMLElement>('[data-cellname^="__global!balance-"]');
		if (cell?.textContent) texts.set(id, cell.textContent);
	}
	return texts;
}

// Reads the native "N uncategorized transactions" button's text, if
// present — there's no push event for (un)categorizing a transaction, so
// comparing this against its last-seen value (see Sidebar.svelte) is the
// only way to detect it outside of a bank sync completing.
export function readNativeUncategorizedButtonText(): string {
	for (const btn of document.querySelectorAll<HTMLButtonElement>("button")) {
		if (btn.textContent?.includes("uncategorized")) return btn.textContent.trim();
	}
	return "";
}

// Re-reads uncategorized counts for just these accounts — same narrow-
// recheck shape as refreshSyncStatuses, but for the uncategorized badge.
// Returns ids whose count actually changed.
export async function refreshUncategorizedCounts(accounts: SidebarAccount[]): Promise<string[]> {
	if (!accounts.length) return [];

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
		if (!tx.account) continue;
		if (tx.category || tx.is_parent || tx.is_child || tx.transfer_id) continue;
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
	if (!account) return;

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

// Real per-account bank sync — the same "accounts-bank-sync" RPC and
// setAccountsSyncing bracketing the native app's own sync mutation uses
// (accounts/mutations.ts's useSyncAccountsMutation), minus its React Query
// cache invalidation, since this sidebar already re-derives its own state
// off the same accountsSyncing dot Redux tracks (see Sidebar.svelte's
// syncingIds effect / readNativeSyncingAccountIds). Dispatching plain
// "sync" (the file-level cloud sync, Titlebar's button) doesn't touch bank
// accounts at all — that was the earlier, wrong action for this.
export async function syncAllAccounts(accounts: SidebarAccount[]): Promise<void> {
	const ids = accounts.filter((a) => a.status !== "manual" && !a.closed).map((a) => a.id);
	if (!ids.length) return;
	await dispatch("setAccountsSyncing", { ids });
	for (const id of ids) {
		try {
			await send("accounts-bank-sync", { ids: [id] });
		} catch {
			// best-effort — one broken/unreachable account shouldn't block the rest
		}
	}
	await dispatch("setAccountsSyncing", { ids: [] });
}
