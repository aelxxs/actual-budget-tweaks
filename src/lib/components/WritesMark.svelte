<script lang="ts">
	import Icon from "./Icon.svelte";

	/** Marks a setting that can change the budget; the text says what, and on which action. */
	const { writes }: { writes: string } = $props();
	const CAVEAT = "Changes go through Actual, so its undo works as usual.";
</script>

<span class="abt-setting__writes" title={`${writes}\n\n${CAVEAT}`}>
	<Icon name="pencil" size={10} />
	Edits budget
</span>
