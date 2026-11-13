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
		margin-top: var(--abt-space-3);
	}
	.callout[data-tone="neutral"] {
		background: var(--abt-panel-surface);
		border-color: var(--abt-panel-border);
		opacity: 0.75;
	}
	.callout[data-tone="positive"] {
		background: var(--abt-positive-1);
		border-color: var(--abt-positive-2);
		color: var(--color-budgetNumberPositive);
	}
	.callout[data-tone="warning"] {
		background: var(--abt-warning-1);
		border-color: var(--abt-warning-2);
		color: var(--color-warningText);
	}
	.callout[data-tone="negative"] {
		background: var(--abt-danger-1);
		border-color: var(--abt-danger-2);
		color: var(--color-errorText);
	}
</style>
