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
		border-radius: 4px;
		border: 1px solid transparent;
		font-size: 10.5px;
		line-height: 1.4;
	}
	.callout:not(:first-child) {
		margin-top: 8px;
	}
	.callout[data-tone="neutral"] {
		background: rgba(255, 255, 255, 0.03);
		border-color: var(--color-menuBorder, rgba(255, 255, 255, 0.06));
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
