<script lang="ts">
	import Section from "@lib/components/panel/Section.svelte";

	const {
		label,
		note,
		empty,
		spread,
		names,
		onPick,
	}: {
		/** The section's name for what's listed, so it doesn't repeat the panel title. */
		label: string;
		note: string;
		empty: string;
		/** Each flagged id with the ids it spreads across. */
		spread: Map<string, Set<string>>;
		names: Map<string, string>;
		onPick: (id: string) => void;
	} = $props();

	const list = $derived(
		[...spread]
			.map(([id, others]) => ({
				id,
				name: names.get(id) ?? "Unknown",
				others: [...others].map((o) => names.get(o) ?? "Unknown").sort(),
			}))
			.sort((a, b) => b.others.length - a.others.length || a.name.localeCompare(b.name)),
	);
</script>

<div>
	<p class="fl__note">{note}</p>
	<Section title={label} count={list.length}>
		{#each list as item (item.id)}
			<button type="button" class="fl__row" onclick={() => onPick(item.id)}>
				<span class="fl__name abt-privacy-number">{item.name}</span>
				<span class="fl__others">{item.others.join(", ")}</span>
			</button>
		{:else}
			<p class="fl__empty">{empty}</p>
		{/each}
	</Section>
</div>

<style>
	/* Inset like the sections below it. */
	.fl__note {
		margin: var(--abt-space-3) 12px var(--abt-space-4); /* raw: the sections' 12px inset */
		font-size: var(--abt-text-sm);
		line-height: 1.4;
		color: var(--abt-muted);
	}

	.fl__empty {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	.fl__row {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		width: 100%;
		padding: 6px var(--abt-space-3); /* raw: matches the panel rows' rhythm */
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.fl__row:hover {
		background: var(--abt-fill-hover);
	}

	.fl__name {
		font-size: var(--abt-text-sm);
		font-weight: 500;
	}

	.fl__others {
		font-size: var(--abt-text-xs);
		line-height: 1.4;
		color: var(--abt-muted);
	}
</style>
