<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		tone = "neutral",
		children,
	}: { tone?: "neutral" | "positive" | "warning" | "negative"; children: Snippet } = $props();
</script>

<div class="callout" data-tone={tone}>{@render children()}</div>

<style>
	.callout {
		padding: 5px 8px;
		border-radius: var(--abt-radius-sm);
		border: 1px solid transparent;
		font-size: var(--abt-text-sm);
		line-height: 1.4;
	}
	.callout:not(:first-child) {
		margin-top: 8px;
	}
	.callout[data-tone="neutral"] {
		background: var(--abt-panel-surface);
		border-color: var(--abt-panel-border);
		opacity: 0.75;
	}
	.callout[data-tone="positive"] {
		background: color-mix(in srgb, var(--color-budgetNumberPositive, #4caf50) 10%, transparent);
		border-color: color-mix(in srgb, var(--color-budgetNumberPositive, #4caf50) 18%, transparent);
		color: var(--color-budgetNumberPositive, #4caf50);
	}
	.callout[data-tone="warning"] {
		background: color-mix(in srgb, var(--color-warningText, #e0c590) 10%, transparent);
		border-color: color-mix(in srgb, var(--color-warningText, #e0c590) 20%, transparent);
		color: var(--color-warningText, #e0c590);
	}
	.callout[data-tone="negative"] {
		background: color-mix(in srgb, var(--color-errorText, #e57373) 10%, transparent);
		border-color: color-mix(in srgb, var(--color-errorText, #e57373) 20%, transparent);
		color: var(--color-errorText, #e57373);
	}
</style>
