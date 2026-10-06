import { calculate, navigate, notify, query, send } from "@lib/utilities/actual-api";
import { whenLock } from "./dom";
import { isPanelShowing, openPanel } from "./panel";

export interface UnclearedRow {
	id: string;
	date: string;
	amount: number;
	payee: string | null;
	notes: string | null;
}

interface AccountRow {
	id: string;
	name: string;
	balance_current: number | null;
	last_reconciled: string | null;
}

export const reconcile = $state({
	accountId: null as string | null,
	accountName: "",
	/** The bank's last synced balance, when the account syncs. */
	bankBalance: null as number | null,
	lastReconciled: null as string | null,
	/** The statement balance being reconciled against; null while not reconciling. */
	target: null as number | null,
	cleared: 0,
	/** Cleared since the last reconcile: what this reconcile will lock. */
	checked: 0,
	/** Uncleared transactions, newest first; split parents stand for their children. */
	unclearedRows: [] as UnclearedRow[],
	busy: false,
	/** While the account view is being re-entered to show our changes. */
	refreshing: false,
});

/**
 * Actual's account view only refetches after its own edits or a remote sync, so changes made here
 * don't show in the table. Leaving and coming back to the route makes it refetch.
 */
async function refreshAccountView(): Promise<void> {
	const panelWasShowing = isPanelShowing();
	reconcile.refreshing = true;
	try {
		// Pushed then popped: Actual's navigate reloads the whole page when asked to replace.
		navigate("/accounts");
		await whenLock(false, 1000);
		navigate(-1);
		await whenLock(true);
	} finally {
		reconcile.refreshing = false;
		// The page change can take the panel with it; put back only what it took.
		if (panelWasShowing && reconcile.target != null && reconcile.accountId && !isPanelShowing()) {
			openPanel(reconcile.accountId, false);
		}
	}
}

export async function loadAccount(id: string): Promise<void> {
	// accounts-get, not a query: the bank balance isn't a queryable field.
	const row = (await send<AccountRow[]>("accounts-get")).find((a) => a.id === id);
	if (!row) return;
	if (reconcile.accountId !== id) reconcile.target = null;
	reconcile.accountId = id;
	reconcile.accountName = row.name;
	reconcile.bankBalance = row.balance_current;
	reconcile.lastReconciled = row.last_reconciled;
	await refreshTotals();
}

// Same sums as Actual's own reconcile: every cleared transaction, splits counted once.
export async function refreshTotals(): Promise<void> {
	const account = reconcile.accountId;
	if (!account) return;
	const [cleared, checked, uncleared] = await Promise.all([
		calculate<number>(
			"transactions",
			{ $sum: "$amount" },
			{ filter: { account, cleared: true }, options: { splits: "none" } },
		),
		calculate<number>(
			"transactions",
			{ $count: "$id" },
			{ filter: { account, cleared: true, reconciled: false }, options: { splits: "none" } },
		),
		query<UnclearedRow[]>("transactions", {
			filter: { account, cleared: false },
			select: ["id", "date", "amount", { payee: "payee.name" }, "notes"],
			options: { splits: "none" },
		}),
	]);
	if (account !== reconcile.accountId) return;
	reconcile.cleared = cleared ?? 0;
	reconcile.checked = checked ?? 0;
	reconcile.unclearedRows = uncleared.sort((a, b) => b.date.localeCompare(a.date));
}

/** Marks a transaction cleared, its split children with it, as ticking it in the table does. */
export async function clearTransaction(id: string): Promise<void> {
	const children = await query<{ id: string }[]>("transactions", {
		filter: { parent_id: id },
		select: ["id"],
		options: { splits: "all" },
	});
	await send("transactions-batch-update", {
		updated: [id, ...children.map((c) => c.id)].map((tid) => ({ id: tid, cleared: true })),
	});
	await refreshTotals();
}

export function start(target: number): void {
	reconcile.target = target;
	void refreshTotals();
}

export function cancel(): void {
	reconcile.target = null;
}

/** Adds the transaction that closes the gap, cleared and run through rules, as Actual does. */
export async function addAdjustment(): Promise<void> {
	const account = reconcile.accountId;
	if (!account || reconcile.target == null || reconcile.busy) return;
	const amount = reconcile.target - reconcile.cleared;
	if (amount === 0) return;
	reconcile.busy = true;
	try {
		const transaction = await send("rules-run", {
			transaction: {
				id: crypto.randomUUID(),
				account,
				amount,
				date: today(),
				cleared: true,
				reconciled: false,
				notes: "Reconciliation balance adjustment",
			},
		});
		await send("transactions-batch-update", { added: [transaction] });
		await refreshAccountView();
		await refreshTotals();
	} catch (err) {
		void notify({ type: "error", message: "Couldn't add the adjustment", pre: String(err) });
	} finally {
		reconcile.busy = false;
	}
}

/** Locks every cleared transaction and records the date, as Actual's "Lock transactions" does. */
export async function finish(): Promise<void> {
	const account = reconcile.accountId;
	if (!account || reconcile.target == null || reconcile.busy) return;
	reconcile.busy = true;
	try {
		await refreshTotals();
		if (reconcile.target !== reconcile.cleared) return;
		const rows = await query<{ id: string }[]>("transactions", {
			filter: { account, cleared: true, reconciled: false },
			select: ["id"],
			// Split parents and their children both carry the flag.
			options: { splits: "all" },
		});
		const steps = (rows.length ? 1 : 0) + 1;
		if (rows.length) {
			await send("transactions-batch-update", {
				updated: rows.map((r) => ({ id: r.id, reconciled: true })),
			});
		}
		const lastReconciled = String(Date.now());
		await send("account-update", {
			id: account,
			name: reconcile.accountName,
			last_reconciled: lastReconciled,
		});
		reconcile.lastReconciled = lastReconciled;
		reconcile.target = null;
		await refreshAccountView();
		const locked = rows.length === 1 ? "1 transaction" : `${rows.length} transactions`;
		void notify(
			{ message: `Reconciled ${reconcile.accountName}, locked ${locked}`, timeout: 12000 },
			{
				title: "Undo",
				action: async () => {
					for (let i = 0; i < steps; i++) await send("undo");
				},
			},
		);
	} catch (err) {
		void notify({ type: "error", message: "Couldn't finish reconciling", pre: String(err) });
	} finally {
		reconcile.busy = false;
	}
}

function today(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
