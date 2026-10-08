<script lang="ts">
	import Callout from "@lib/components/panel/Callout.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import type { RecapGroup, RecapTransaction } from "./data";

	let {
		transactions,
		groups,
		matched,
		failed,
		onCategorize,
		onDone,
	}: {
		transactions: RecapTransaction[];
		groups: RecapGroup[];
		matched: number;
		/** Names of accounts whose bank sync failed. */
		failed: string[];
		onCategorize: (id: string, category: string) => Promise<void>;
		onDone: () => void;
	} = $props();

	let txs = $state(transactions.map((t) => ({ ...t })));
	let saving = $state<Record<string, boolean>>({});
	let errors = $state<Record<string, boolean>>({});

	const categoryNames = $derived(
		new Map(groups.flatMap((g) => g.categories.map((c) => [c.id, c.name] as const))),
	);
	// Rows stay in this list once categorized, so the one being worked on doesn't jump away.
	const toCategorize = $state(
		transactions.filter((t) => t.needsCategory && !t.category).map((t) => t.id),
	);
	const remaining = $derived(txs.filter((t) => toCategorize.includes(t.id) && !t.category).length);
	const moneyIn = $derived(txs.reduce((sum, t) => sum + Math.max(t.amount, 0), 0));
	const moneyOut = $derived(txs.reduce((sum, t) => sum + Math.min(t.amount, 0), 0));
	const byAccount = $derived.by(() => {
		const map = new Map<string, { name: string; rows: typeof txs }>();
		for (const t of txs) {
			const entry = map.get(t.account) ?? { name: t.accountName, rows: [] };
			entry.rows.push(t);
			map.set(t.account, entry);
		}
		return [...map.values()];
	});

	function shortDate(iso: string): string {
		const [y, m, d] = iso.split("-").map(Number);
		return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	async function choose(tx: (typeof txs)[number], category: string) {
		if (!category) return;
		const before = tx.category;
		tx.category = category;
		saving[tx.id] = true;
		errors[tx.id] = false;
		try {
			await onCategorize(tx.id, category);
		} catch {
			tx.category = before;
			errors[tx.id] = true;
		} finally {
			saving[tx.id] = false;
		}
	}
</script>

<div class="shell">
	<div class="recap">
		<Section title="Summary" collapsible={false}>
			<Row name="New transactions" value={String(txs.length)} />
			<Row name="Money in" value={fmtMoney(moneyIn)} tone={moneyIn > 0 ? "positive" : "muted"} />
			<Row name="Money out" value={fmtMoney(moneyOut)} tone={moneyOut < 0 ? "negative" : "muted"} />
			{#if matched > 0}
				<Row name="Matched existing" value={String(matched)} tone="muted" />
			{/if}
			{#if failed.length}
				<Callout tone="negative">Bank sync failed for {failed.join(", ")}.</Callout>
			{/if}
			{#if toCategorize.length}
				<Callout tone={remaining ? "warning" : "positive"}>
					{remaining
						? `${remaining} of ${toCategorize.length} ${remaining === 1 ? "needs" : "need"} a category.`
						: "Everything is categorized."}
				</Callout>
			{/if}
		</Section>

		{#if toCategorize.length}
			<Section title="Needs a category" count={remaining || undefined}>
				<ul class="list">
					{#each txs.filter((t) => toCategorize.includes(t.id)) as tx (tx.id)}
						<li class="item" class:done={!!tx.category}>
							<div class="line">
								<span class="payee abt-privacy-number">{tx.payee}</span>
								<span class="amount abt-privacy-number" class:positive={tx.amount > 0}
									>{fmtMoney(tx.amount)}</span
								>
							</div>
							<div class="meta">{shortDate(tx.date)} · {tx.accountName}</div>
							<select
								class="abt-input picker"
								class:chosen={!!tx.category}
								value={tx.category ?? ""}
								disabled={saving[tx.id]}
								aria-label={`Category for ${tx.payee}`}
								onchange={(e) => choose(tx, (e.currentTarget as HTMLSelectElement).value)}
							>
								<option value="" disabled>Choose a category…</option>
								{#each groups as group (group.id)}
									<optgroup label={group.name}>
										{#each group.categories as cat (cat.id)}
											<option value={cat.id}>{cat.name}</option>
										{/each}
									</optgroup>
								{/each}
							</select>
							{#if errors[tx.id]}
								<div class="error">Couldn't save. Try again.</div>
							{/if}
						</li>
					{/each}
				</ul>
			</Section>
		{/if}

		{#each byAccount as account (account.name)}
			<Section title={account.name} count={account.rows.length} open={byAccount.length <= 3}>
				{#each account.rows as tx (tx.id)}
					<Row
						name={tx.payee}
						sensitive
						meta={`${shortDate(tx.date)}${tx.category ? ` · ${categoryNames.get(tx.category) ?? ""}` : tx.needsCategory ? " · Uncategorized" : ""}`}
						value={fmtMoney(tx.amount)}
						tone={tx.amount > 0 ? "positive" : undefined}
					/>
				{/each}
			</Section>
		{/each}
	</div>
	<div class="footer">
		<button type="button" class="abt-btn abt-tone-accent done" onclick={onDone}>Done</button>
	</div>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.footer {
		flex-shrink: 0;
		padding: var(--abt-space-3);
		border-top: 1px solid var(--abt-ink-2);
	}
	.done {
		width: 100%;
	}
	.recap {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3);
		overflow-y: auto;
		min-height: 0;
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
	.picker {
		width: 100%;
	}
	.picker.chosen {
		border-color: var(--abt-accent-3);
	}
	.item.done .payee,
	.item.done .amount {
		color: var(--abt-soft);
	}
	.error {
		font-size: var(--abt-text-sm);
		color: var(--color-errorText);
	}
</style>
