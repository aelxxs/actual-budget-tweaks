<script lang="ts">
	import type { Account } from "@lib/types/actual-schema";
	import { dispatch, query } from "@lib/utilities/actual-api";
	import { PanelLeftClose, Redo2, RefreshCw, Undo2 } from "lucide-svelte";
	import { tooltip } from "../actions/tooltip.svelte";
	import { syncAllAccounts, type SidebarAccount } from "../lib/data";
	import { isMac } from "../lib/search";

	const { accounts = [], onCollapse }: { accounts?: SidebarAccount[]; onCollapse?: () => void } =
		$props();

	const undoShortcut = $derived(isMac() ? "⌘Z" : "Ctrl+Z");
	const redoShortcut = $derived(isMac() ? "⌘⇧Z" : "Ctrl+Shift+Z");

	const linked = $derived(accounts.filter((a) => a.status !== "manual" && !a.closed));
	let running = $state(false);
	const syncing = $derived(running || linked.some((a) => a.status === "syncing"));

	/** Oldest linked account's last sync, read live from Actual, never stored. */
	let lastSync = $state<number | null>(null);

	async function loadLastSync() {
		const ids = linked.map((a) => a.id);
		if (!ids.length) return;
		try {
			const rows = await query<Pick<Account, "id" | "last_sync">[]>("accounts", {
				filter: { id: { $oneof: ids } },
				select: ["id", "last_sync"],
			});
			const times = rows.map((r) => Number(r.last_sync)).filter((t) => t > 0);
			lastSync = times.length ? Math.min(...times) : null;
		} catch {
			lastSync = null;
		}
	}

	// Refreshed after each sync ends (and once the linked accounts are known).
	$effect(() => {
		if (!syncing && linked.length) void loadLastSync();
	});

	function ago(time: number): string {
		const mins = Math.round((Date.now() - time) / 60000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
	}

	const syncTip = $derived(
		syncing
			? "Syncing bank accounts…"
			: lastSync
				? `Sync bank accounts · last synced ${ago(lastSync)}`
				: "Sync bank accounts",
	);

	async function sync() {
		if (syncing) return;
		running = true;
		try {
			await syncAllAccounts(accounts);
		} finally {
			running = false;
		}
	}

	async function undo() {
		await dispatch("undo");
	}

	async function redo() {
		await dispatch("redo");
	}
</script>

<div class="footer">
	<div class="undo-group" role="group" aria-label="History">
		<button
			type="button"
			aria-label="Undo {undoShortcut}"
			use:tooltip={{ text: `Undo ${undoShortcut}`, placement: "top" }}
			onclick={undo}
		>
			<Undo2 strokeWidth={1.8} />
		</button>
		<button
			type="button"
			aria-label="Redo {redoShortcut}"
			use:tooltip={{ text: `Redo ${redoShortcut}`, placement: "top" }}
			onclick={redo}
		>
			<Redo2 strokeWidth={1.8} />
		</button>
	</div>
	<div class="footer-actions">
		{#if linked.length}
			<button
				type="button"
				class="sync-btn"
				class:is-syncing={syncing}
				disabled={syncing}
				aria-label={syncTip}
				use:tooltip={{ text: syncTip, placement: "top" }}
				onclick={sync}
			>
				<RefreshCw strokeWidth={1.8} />
				<span>{syncing ? "Syncing" : "Sync"}</span>
			</button>
		{/if}
		{#if onCollapse}
			<button
				type="button"
				class="collapse"
				aria-label="Collapse sidebar"
				use:tooltip={{ text: "Collapse sidebar", placement: "top" }}
				onclick={onCollapse}
			>
				<PanelLeftClose strokeWidth={1.5} />
			</button>
		{/if}
	</div>
</div>
