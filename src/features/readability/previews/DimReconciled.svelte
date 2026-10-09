<script lang="ts">
	import MockTransactions from "./MockTransactions.svelte";
	import PreviewPair from "./PreviewPair.svelte";
</script>

<PreviewPair>
	{#snippet sample(on)}
		<MockTransactions dim={on} />
	{/snippet}
</PreviewPair>
