<script lang="ts">
	import CategoryPicker from "@lib/components/CategoryPicker.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/format/currency";
	import { formatDayMonth } from "@lib/format/date-format.svelte";
	import { onMount, untrack } from "svelte";
	import { CheckCheck } from "@lucide/svelte";
	import { cachedIcons, loadIconCache, watchAccountIcons } from "@lib/account-icons";
	import { query } from "@lib/actual/actual-api";
	import type { Account } from "@lib/types/actual-schema";
	import { syncAccounts } from "@features/workflows/sidebar/lib/data";
	import {
		loadCategoryGroups,
		loadTransactions,
		type RecapGroup,
		type RecapTransaction,
		setCategory,
	} from "./data";
	import { pendingIds, pruned, without } from "./queue";
	import { reviewState, updateQueue } from "./queue-state.svelte";

	const { account = null, onDone }: { account?: string | null; onDone: () => void } = $props();

	// The account being reviewed; null for all of them.
	let only = $state<string | null>(untrack(() => account));

	let groups = $state<RecapGroup[]>([]);
	let byId = $state<Record<string, RecapTransaction>>({});
	let saving = $state<Record<string, boolean>>({});
	let errors = $state<Record<string, boolean>>({});
	let loaded = $state(false);

	let icons = $state(cachedIcons() ?? {});
	onMount(() => {
		void loadCategoryGroups().then((g) => (groups = g));
		void loadIconCache().then((v) => (icons = v));
	});
	$effect(() => watchAccountIcons((v) => (icons = v)));

	// Loads what the queue lists and this panel hasn't read yet, so a sync landing while it's open
	// shows up too. Transactions gone from the budget are dropped from the queue.
	const requested = new Set<string>();
	$effect(() => {
		const missing = pendingIds(reviewState.queue).filter((id) => !requested.has(id));
		if (!missing.length) {
			loaded = true;
			return;
		}
		missing.forEach((id) => requested.add(id));
		void loadTransactions(missing).then((rows) => {
			for (const row of rows) {
				byId[row.id] = row;
			}
			const found = new Set(rows.map((r) => r.id));
			const gone = missing.filter((id) => !found.has(id));
			loaded = true;
			if (gone.length) {
				const existing = new Set(pendingIds(reviewState.queue).filter((id) => !gone.includes(id)));
				void updateQueue((q) => pruned(q, existing, Date.now()));
			}
		});
	});

	const loadedAll = $derived(
		reviewState.queue.batches.flatMap((b) => b.pending.map((id) => byId[id]).filter(Boolean)),
	);
	// One chip per account with something to review, busiest first.
	const accounts = $derived.by(() => {
		const map = new Map<string, { id: string; name: string; count: number }>();
		for (const t of loadedAll) {
			const entry = map.get(t.account) ?? { id: t.account, name: t.accountName, count: 0 };
			entry.count++;
			map.set(t.account, entry);
		}
		return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	});
	// Its last transaction reviewed, the filter goes back to every account.
	$effect(() => {
		if (only && loaded && !accounts.some((a) => a.id === only)) {
			only = null;
		}
	});

	const batches = $derived(
		reviewState.queue.batches
			.map((b) => ({
				...b,
				rows: b.pending
					.map((id) => byId[id])
					.filter((t) => t && (!only || t.account === only))
					.sort((a, b) => b.date.localeCompare(a.date)),
			}))
			.filter((b) => !only || b.rows.length),
	);
	const all = $derived(batches.flatMap((b) => b.rows));
	const uncategorized = $derived(all.filter((t) => t.needsCategory && !t.category).length);
	const moneyIn = $derived(all.reduce((sum, t) => sum + Math.max(t.amount, 0), 0));
	const moneyOut = $derived(all.reduce((sum, t) => sum + Math.min(t.amount, 0), 0));

	function when(at: number): string {
		const d = new Date(at);
		const days = Math.round(
			(new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000,
		);
		const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
		if (days === 0) {
			return `Today, ${time}`;
		}
		if (days === 1) {
			return `Yesterday, ${time}`;
		}
		return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${formatDayMonth(d)}`;
	}

	const shortDate = (iso: string) => formatDayMonth(iso);

	async function choose(tx: RecapTransaction, category: string | null) {
		const before = tx.category;
		byId[tx.id] = { ...tx, category };
		saving[tx.id] = true;
		errors[tx.id] = false;
		try {
			await setCategory(tx.id, category);
		} catch {
			byId[tx.id] = { ...tx, category: before };
			errors[tx.id] = true;
		} finally {
			saving[tx.id] = false;
		}
	}

	const review = (ids: string[]) => updateQueue((q) => without(q, ids));

	// ── Caught up: when each bank-linked account last synced, and a way to sync them now ──
	let linked = $state<{ id: string; name: string; at: number }[]>([]);
	let syncing = $state(false);

	async function loadLinked() {
		try {
			const rows = await query<Pick<Account, "id" | "name" | "closed" | "last_sync">[]>(
				"accounts",
				{
					filter: { closed: false },
					select: ["id", "name", "closed", "last_sync"],
				},
			);
			// Actual keeps the time as milliseconds in a string; manual accounts have none.
			linked = rows
				.map((r) => ({ id: r.id, name: r.name, at: Number(r.last_sync) }))
				.filter((r) => r.at > 0)
				.sort((a, b) => b.at - a.at);
		} catch {
			linked = [];
		}
	}
	onMount(() => void loadLinked());

	async function syncNow() {
		syncing = true;
		try {
			await syncAccounts(linked.map((a) => a.id));
		} finally {
			syncing = false;
			void loadLinked();
		}
	}

	function ago(at: number): string {
		const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
		if (mins < 1) {
			return "Just now";
		}
		if (mins < 60) {
			return `${mins}m ago`;
		}
		const hours = Math.round(mins / 60);
		return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
	}
</script>

<div class="shell">
	<div class="recap">
		{#if !loaded}
			<p class="empty">Loading…</p>
		{:else if !all.length}
			<div class="caught-up">
				<span class="caught-up__mark"><CheckCheck size={22} strokeWidth={1.85} /></span>
				<strong>All caught up</strong>
				<span>New transactions from a bank sync or import show up here to review.</span>
			</div>
			{#if linked.length}
				<Section title="Last synced" collapsible={false}>
					{#each linked as a (a.id)}
						<Row name={a.name} value={ago(a.at)} tone="muted" sensitive />
					{/each}
				</Section>
			{/if}
		{:else}
			{#if accounts.length > 1}
				<div class="accounts abt-cluster abt-gap-2" role="group" aria-label="Account">
					<button
						type="button"
						class="abt-btn abt-btn--sm abt-btn--pill"
						aria-pressed={!only}
						onclick={() => (only = null)}
						>All <span class="chip-count">{loadedAll.length}</span></button
					>
					{#each accounts as a (a.id)}
						<button
							type="button"
							class="abt-btn abt-btn--sm abt-btn--pill"
							aria-pressed={only === a.id}
							onclick={() => (only = a.id)}
						>
							{#if icons[a.id]?.type === "emoji"}
								<span class="abt-emoji chip-icon" aria-hidden="true">{icons[a.id].value}</span>
							{:else if icons[a.id]}
								<img class="chip-icon" src={icons[a.id].value} alt="" />
							{/if}
							{a.name} <span class="chip-count">{a.count}</span></button
						>
					{/each}
				</div>
			{/if}
			<Section title="Summary" collapsible={false}>
				<Row name="To review" value={String(all.length)} />
				<Row name="Money in" value={fmtMoney(moneyIn)} tone={moneyIn > 0 ? "positive" : "muted"} />
				<Row
					name="Money out"
					value={fmtMoney(moneyOut)}
					tone={moneyOut < 0 ? "negative" : "muted"}
				/>
				{#if uncategorized}
					<Row name="Needs a category" value={String(uncategorized)} tone="warning" />
				{/if}
			</Section>

			{#each batches as batch (batch.at)}
				<!-- With one batch, the footer's button already reviews it. -->
				{#snippet reviewBatch()}
					<button
						type="button"
						class="abt-btn abt-btn--sm abt-btn--ghost review-batch"
						onclick={(e) => {
							e.stopPropagation();
							void review(only ? batch.rows.map((t) => t.id) : batch.pending);
						}}>Mark reviewed</button
					>
				{/snippet}
				<Section
					title={when(batch.at)}
					count={!only && batch.rows.length < batch.total
						? `${batch.rows.length} of ${batch.total}`
						: batch.rows.length}
					caps={false}
					privateTrailing={false}
					trailing={batches.length > 1 ? reviewBatch : undefined}
				>
					<ul class="list">
						{#each batch.rows as tx (tx.id)}
							<li class="item">
								<div class="line">
									<span class="payee abt-privacy-number">{tx.payee}</span>
									<span class="amount abt-privacy-number" class:positive={tx.amount > 0}
										>{fmtMoney(tx.amount)}</span
									>
								</div>
								<div class="meta">{shortDate(tx.date)} · {tx.accountName}</div>
								{#if tx.needsCategory}
									<CategoryPicker
										{groups}
										value={tx.category}
										label="Category for {tx.payee}"
										clearLabel="Uncategorized"
										attention={!tx.category}
										disabled={saving[tx.id]}
										onPick={(id) => choose(tx, id)}
									/>
								{/if}
								{#if errors[tx.id]}
									<div class="error">Couldn't save. Try again.</div>
								{/if}
							</li>
						{/each}
					</ul>
				</Section>
			{/each}
		{/if}
	</div>
	<div class="footer">
		{#if !all.length && loaded && linked.length}
			<button
				type="button"
				class="abt-btn abt-tone-accent grow"
				disabled={syncing}
				onclick={() => void syncNow()}>{syncing ? "Syncing…" : "Sync now"}</button
			>
		{/if}
		{#if all.length}
			<button
				type="button"
				class="abt-btn abt-tone-accent grow"
				onclick={() => void review(only ? all.map((t) => t.id) : pendingIds(reviewState.queue))}
				>{only ? "Mark these reviewed" : "Mark all reviewed"}</button
			>
		{/if}
		<button
			type="button"
			class="abt-btn"
			class:grow={!all.length && !linked.length}
			onclick={onDone}>Close</button
		>
	</div>
</div>

<style>
	.review-batch {
		--abt-btn-fg: var(--abt-accent-text);
	}

	.shell {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.footer {
		display: flex;
		flex-shrink: 0;
		gap: var(--abt-space-2);
		padding: var(--abt-space-3);
		border-top: 1px solid var(--abt-ink-2);
	}
	.grow {
		flex: 1;
	}
	/* Sections bring their own gutter and spacing, as in Insights. */
	.recap {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--abt-space-3) 0;
		overflow-y: auto;
		min-height: 0;
	}
	.accounts {
		flex-wrap: wrap;
		padding: 0 var(--abt-space-3) var(--abt-space-3);
	}
	.accounts .abt-btn[aria-pressed="true"] {
		border-color: var(--abt-accent-4);
		background: var(--abt-accent-2);
		color: var(--abt-accent-text);
	}
	.chip-icon {
		--abt-emoji-size: 14px;
		width: 14px;
		height: 14px;
		border-radius: var(--abt-radius-sm);
		object-fit: cover;
	}
	.chip-count {
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}
	/* The caught-up state: a mark, what it means, then when the banks last synced. */
	.caught-up {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--abt-space-2);
		padding: var(--abt-space-6) var(--abt-space-5) var(--abt-space-6);
		text-align: center;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.caught-up strong {
		font-size: var(--abt-text-lg);
		color: var(--color-pageText);
	}
	.caught-up__mark {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		margin-bottom: var(--abt-space-2);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-positive-2);
		color: var(--color-budgetNumberPositive);
	}
	.empty {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		margin: 0;
		padding: var(--abt-space-6) var(--abt-space-3);
		text-align: center;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.item {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		padding: var(--abt-space-3) 0;
		border-top: 1px solid var(--abt-ink-2);
	}
	.item:first-child {
		border-top: none;
		padding-top: 0;
	}
	.line {
		display: flex;
		justify-content: space-between;
		gap: var(--abt-space-3);
		font-size: var(--abt-text-md);
	}
	.payee {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.amount {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}
	.amount.positive {
		color: var(--color-noticeTextLight);
	}
	.meta {
		font-size: var(--abt-text-sm);
		color: var(--abt-subtle);
	}
	.error {
		font-size: var(--abt-text-sm);
		color: var(--color-errorText);
	}
</style>
