<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { inspector } from "./state.svelte";

	const { onclick }: { onclick: () => void } = $props();
</script>

<button
	type="button"
	class="ib abt-btn abt-btn--sm abt-btn--ghost"
	class:is-active={inspector.open}
	title="Inspect the transaction you select: payee history, rules and schedule"
	{onclick}
>
	<Icon name="eye" size={15} />
	<span>Inspect</span>
</button>

<style>
	.ib.is-active {
		border-color: var(--abt-accent-3) !important;
		background: var(--abt-accent-2) !important;
		color: var(--abt-accent-text) !important;
	}
</style>
