<script lang="ts">
	import { ACTIONS } from "./actions";
	import { BINDINGS, type ShortcutId, keyLabels } from "./bindings.svelte";

	const ids = Object.keys(BINDINGS) as ShortcutId[];
</script>

<ul class="list">
	{#each ids as id (id)}
		<li class="row">
			<span class="keys">
				{#each keyLabels(id) as key (key)}<kbd class="abt-kbd">{key}</kbd>{/each}
			</span>
			<span>{ACTIONS[id].label}</span>
		</li>
	{/each}
</ul>

<style>
	.list {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--abt-space-2) var(--abt-space-4);
		margin: 0;
		padding: var(--abt-space-3) var(--abt-space-4);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: var(--color-tableBackground);
		list-style: none;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	/* Each row's two cells join the list's grid, so the labels line up. */
	.row {
		display: contents;
	}

	.keys {
		display: flex;
		gap: var(--abt-space-1);
	}
</style>
