<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { inspector } from "./state.svelte";

	const { onclick }: { onclick: () => void } = $props();
</script>

<button
	type="button"
	class="ib abt-btn abt-btn--sm abt-btn--ghost"
	class:is-active={inspector.open}
	title="Inspect a transaction"
	data-abt-tip-hint="Payee history, rules and schedule for the one you select"
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
