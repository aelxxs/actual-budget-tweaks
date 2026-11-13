<script lang="ts">
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/format/currency";
	import { formatDayMonth } from "@lib/format/date-format.svelte";
	import type { Unusual } from "./data";

	const {
		note,
		charges,
		names,
		onPick,
	}: {
		note: string;
		charges: Unusual[];
		names: Map<string, string>;
		onPick: (charge: Unusual) => void;
	} = $props();

	const pct = (ratio: number) => `${ratio > 0 ? "+" : ""}${Math.round(ratio * 100)}%`;
</script>

<div>
	<p class="ul__note">{note}</p>
	<Section title="Charges" count={charges.length}>
		{#each charges as u (u.row.id)}
			<button type="button" class="ul__row" onclick={() => onPick(u)}>
				<Row
					name={names.get(u.row.payee ?? "") ?? "Unknown"}
					meta={names.get(u.row.account ?? "") ?? ""}
					sensitive
					value={fmtMoney(u.row.amount)}
					tone="negative"
				/>
				<span class="ul__sub">
					{formatDayMonth(u.row.date)} · usually {fmtMoney(u.usual)} · {pct(u.ratio)}
				</span>
			</button>
		{:else}
			<p class="ul__empty">No steady bill went up.</p>
		{/each}
	</Section>
</div>

<style>
	/* Inset like the sections below it. */
	.ul__note {
		margin: var(--abt-space-3) 12px var(--abt-space-4); /* raw: the sections' 12px inset */
		font-size: var(--abt-text-sm);
		line-height: 1.4;
		color: var(--abt-muted);
	}

	.ul__empty {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	/* Bled into the card's padding so the hover fill reaches its edges. */
	.ul__row {
		display: flex;
		flex-direction: column;
		gap: 2px; /* raw: the detail line sits tight under its row */
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

	.ul__row:hover {
		background: var(--abt-fill-hover);
	}

	.ul__sub {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}
</style>
