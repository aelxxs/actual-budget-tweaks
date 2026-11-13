<script lang="ts">
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { formatDayMonth } from "@lib/utilities/date-format.svelte";
	import type { NodeKind, TransferSum, TxRow } from "./data";

	const {
		kind,
		rows,
		transfers = [],
		names,
		onInspect,
	}: {
		kind: NodeKind;
		rows: TxRow[];
		/** An account's transfers, kept out of its money in and out. */
		transfers?: TransferSum[];
		names: Map<string, string>;
		/** Set when the transaction inspector is on; each row then opens it. */
		onInspect?: (id: string) => void;
	} = $props();

	const SHOWN = 100;

	const out = $derived(rows.reduce((sum, r) => sum + Math.min(0, r.amount), 0));
	const into = $derived(rows.reduce((sum, r) => sum + Math.max(0, r.amount), 0));
	const movedOut = $derived(transfers.reduce((sum, t) => sum + Math.min(0, t.amount), 0));
	const movedIn = $derived(transfers.reduce((sum, t) => sum + Math.max(0, t.amount), 0));

	// What each row names: the payee, except on a payee's own panel, where that's the category.
	const nameOf = (r: TxRow) =>
		kind === "payee"
			? (names.get(r.category ?? "uncategorized") ?? "Uncategorized")
			: (names.get(r.payee ?? "") ?? "No payee");
	// The other end: a category's or payee's rows name their account, an account's the category.
	const otherOf = (r: TxRow) =>
		(kind === "account" ? names.get(r.category ?? "uncategorized") : names.get(r.account ?? "")) ??
		"";

	interface Folded {
		/** The newest transaction behind the row, which the inspector opens. */
		id: string;
		name: string;
		other: string;
		amount: number;
		count: number;
	}

	/** Rows grouped by day, with same-day repeats (same name and other end) folded into one. */
	const days = $derived.by(() => {
		const out: { date: string; rows: Folded[] }[] = [];
		for (const r of rows.slice(0, SHOWN)) {
			let day = out.at(-1);
			if (day?.date !== r.date) {
				day = { date: r.date, rows: [] };
				out.push(day);
			}
			const name = nameOf(r);
			const other = otherOf(r);
			const same = day.rows.find((f) => f.name === name && f.other === other);
			if (same) {
				same.amount += r.amount;
				same.count++;
			} else {
				day.rows.push({ id: r.id, name, other, amount: r.amount, count: 1 });
			}
		}
		return out;
	});
</script>

<div>
	<Section title="Summary" collapsible={false}>
		<Row name="Transactions" value={String(rows.length)} />
		{#if out}
			<Row name="Money out" value={fmtMoney(out)} tone="negative" />
		{/if}
		{#if into}
			<Row name="Money in" value={fmtMoney(into)} tone="positive" />
		{/if}
		{#if movedOut}
			<Row name="Moved out" value={fmtMoney(movedOut)} tone="negative" />
		{/if}
		{#if movedIn}
			<Row name="Moved in" value={fmtMoney(movedIn)} tone="positive" />
		{/if}
	</Section>

	{#if transfers.length}
		<Section title="Transfers" count={transfers.length}>
			{#each transfers as t (t.id)}
				{@render entry(
					t.id,
					`${t.amount < 0 ? "To" : "From"} ${names.get(t.account) ?? "Unknown"}`,
					"",
					t.count,
					t.amount,
				)}
			{/each}
		</Section>
	{/if}

	{#if rows.length || !transfers.length}
		<Section title="Transactions" count={rows.length}>
			{#each days as day (day.date)}
				<p class="nd__day">{formatDayMonth(day.date)}</p>
				{#each day.rows as f (f.id)}
					{@render entry(f.id, f.name, f.other, f.count, f.amount)}
				{/each}
			{/each}
			{#if rows.length > SHOWN}
				<p class="nd__more">{rows.length - SHOWN} older ones aren't listed.</p>
			{/if}
		</Section>
	{/if}
</div>

{#snippet entry(id: string, name: string, other: string, count: number, amount: number)}
	{#snippet row()}
		<Row
			{name}
			meta={other}
			{count}
			sensitive
			value={fmtMoney(amount)}
			tone={amount < 0 ? "negative" : amount > 0 ? "positive" : undefined}
		/>
	{/snippet}
	{#if onInspect}
		<button
			type="button"
			class="nd__row"
			title={count > 1 ? "Inspect the newest of these" : "Inspect this transaction"}
			onclick={() => onInspect(id)}
		>
			{@render row()}
		</button>
	{:else}
		<div class="nd__row is-static">{@render row()}</div>
	{/if}
{/snippet}

<style>
	/* Bled into the card's padding so the hover fill reaches its edges. */
	.nd__row {
		display: block;
		width: calc(100% + 2 * var(--abt-space-3));
		margin: 0 calc(-1 * var(--abt-space-3));
		/* Each Row is alone in its button, so its own first/last-child spacing drops to nothing. */
		padding: var(--abt-space-2) var(--abt-space-3);
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.nd__row.is-static {
		cursor: default;
	}

	.nd__day {
		margin: var(--abt-space-4) 0 var(--abt-space-1);
		font-size: var(--abt-text-xs);
		font-weight: 600;
		color: var(--abt-muted);
	}

	.nd__day:first-child {
		margin-top: 0;
	}

	button.nd__row:hover {
		background: var(--abt-fill-hover);
	}

	.nd__more {
		margin: var(--abt-space-2) 0 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
</style>
