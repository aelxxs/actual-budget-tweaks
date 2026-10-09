<script lang="ts">
	import type { Snippet } from "svelte";

	/** The same mock drawn twice, without and with the tweak. */
	const { sample }: { sample: Snippet<[boolean]> } = $props();
</script>

<div class="pair">
	{#each [false, true] as on (on)}
		<figure class="pair__side">
			<figcaption class="abt-label">{on ? "On" : "Off"}</figcaption>
			{@render sample(on)}
		</figure>
	{/each}
</div>

<style>
	.pair {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--abt-space-4);
	}

	.pair__side {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		min-width: 0;
		margin: 0;
	}
</style>
