<script lang="ts">
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { formatDayMonth } from "@lib/utilities/date-format.svelte";
	import type { TxRow } from "./data";

	const {
		note,
		sets,
		names,
		onPick,
	}: {
		note: string;
		/** Each set of look-alike charges, oldest first. */
		sets: TxRow[][];
		names: Map<string, string>;
		onPick: (set: TxRow[]) => void;
	} = $props();
</script>

<div>
	<p class="dl__note">{note}</p>
	<Section title="Charges" count={sets.length}>
		{#each sets as set (set[0].id)}
			<button type="button" class="dl__row" onclick={() => onPick(set)}>
				<Row
					name={names.get(set[0].payee ?? "") ?? "Unknown"}
					meta={names.get(set[0].account ?? "") ?? ""}
					count={set.length}
					sensitive
					value={fmtMoney(set[0].amount)}
					tone={set[0].amount < 0 ? "negative" : "positive"}
				/>
				<span class="dl__dates">{set.map((r) => formatDayMonth(r.date)).join(", ")}</span>
			</button>
		{:else}
			<p class="dl__empty">No charges look entered twice.</p>
		{/each}
	</Section>
</div>

<style>
	/* Inset like the sections below it. */
	.dl__note {
		margin: var(--abt-space-3) 12px var(--abt-space-4); /* raw: the sections' 12px inset */
		font-size: var(--abt-text-sm);
		line-height: 1.4;
		color: var(--abt-muted);
	}

	.dl__empty {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	/* Bled into the card's padding so the hover fill reaches its edges. */
	.dl__row {
		display: flex;
		flex-direction: column;
		gap: 2px; /* raw: the dates sit tight under their row */
		width: calc(100% + 2 * var(--abt-space-3));
		margin: 0 calc(-1 * var(--abt-space-3));
		padding: var(--abt-space-2) var(--abt-space-3);
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.dl__row:hover {
		background: var(--abt-fill-hover);
	}

	.dl__dates {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}
</style>
