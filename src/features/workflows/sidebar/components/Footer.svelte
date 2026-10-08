<script lang="ts">
	import type { Account } from "@lib/types/actual-schema";
	import { dispatch, query } from "@lib/utilities/actual-api";
	import { openSidebarSettings } from "@features/appearance/sidebar-settings-menu/settings";
	import { PanelLeftClose, Redo2, RefreshCw, SlidersHorizontal, Undo2 } from "lucide-svelte";
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
		<button
			type="button"
			class="footer-settings"
			aria-label="Sidebar settings"
			use:tooltip={{ text: "Sidebar settings", placement: "top" }}
			onclick={() => openSidebarSettings()}
		>
			<SlidersHorizontal strokeWidth={1.8} />
		</button>
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

<style>
	/* The panel's base: same shade as the rail beside it, so the two read as one footing. */
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		box-sizing: border-box;
		/* 9px below centres the 26px controls on the rail's bottom icon (4px rail padding + half
		   its 36px slot); the same above keeps it balanced. */
		padding: 9px 0.65rem;
		border-top: 1px solid var(--abt-ink-2);
		flex-shrink: 0;
	}
	/* In the single-panel layout the body's own bottom padding would add to the footer's. */
	:global(.sidebar > .body) > .footer {
		margin-bottom: -0.75rem;
	}
	.footer-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	/* Undo and redo joined into one control, so they read as a pair. */
	.undo-group {
		display: inline-flex;
		border: 1px solid var(--abt-ink-2);
		border-radius: 7px;
		background: var(--sb-surface);
		overflow: hidden;
	}
	.undo-group button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 24px;
		color: var(--abt-soft);
		transition:
			color 0.12s ease,
			background 0.12s ease;
	}
	.undo-group button + button {
		border-left: 1px solid var(--abt-ink-2);
	}
	.undo-group button:hover {
		color: var(--abt-ink);
		background: var(--abt-ink-2);
	}
	.undo-group :global(svg) {
		width: 15px;
		height: 15px;
	}
	/* Sidebar settings: an icon-only box matching the Sync button beside it. */
	.footer-settings {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--abt-ink-2);
		border-radius: 7px;
		background: var(--sb-surface);
		color: var(--abt-soft);
		transition:
			background 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}
	.footer-settings:hover {
		background: var(--sb-surface-hover);
		border-color: var(--abt-ink-5);
		color: var(--abt-ink);
	}
	.footer-settings :global(svg) {
		width: 15px;
		height: 15px;
	}
	/* Syncs every linked account, so it carries a label; spins while any is syncing. */
	.sync-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px 0 9px;
		border: 1px solid var(--abt-ink-2);
		border-radius: 7px;
		background: var(--sb-surface);
		font-size: 12.5px;
		font-weight: 500;
		/* Muted like the undo/redo icons, so the footer recedes until it's needed. */
		color: var(--abt-soft);
		transition:
			background 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}
	.sync-btn:hover:not(:disabled) {
		background: var(--sb-surface-hover);
		border-color: var(--abt-ink-5);
		color: var(--abt-ink);
	}
	.sync-btn:disabled {
		cursor: default;
		color: var(--abt-soft);
	}
	.sync-btn :global(svg) {
		width: 14px;
		height: 14px;
	}
	.sync-btn.is-syncing :global(svg) {
		color: var(--sb-attention);
		animation: abt-orbit 0.95s linear infinite;
	}
	@media (prefers-reduced-motion: reduce) {
		.sync-btn.is-syncing :global(svg) {
			animation: none;
		}
	}
	.collapse {
		display: flex;
		align-items: center;
		padding: 5px;
		color: var(--abt-soft);
		border-radius: 6px;
		transition:
			color 0.12s ease,
			background 0.12s ease;
	}
	.collapse:hover {
		color: var(--abt-ink);
		background: var(--abt-ink-2);
	}
	.collapse :global(svg) {
		width: 18px;
		height: 18px;
	}
</style>
