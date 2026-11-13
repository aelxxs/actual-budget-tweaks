<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		tone,
		children,
	}: { tone: "positive" | "neutral" | "warning" | "negative"; children: Snippet } = $props();
</script>

<span class="badge" data-tone={tone}>{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		padding: 1px 6px;
		border-radius: var(--abt-radius-pill);
		font-size: var(--abt-text-2xs);
		font-weight: 700;
		letter-spacing: 0.2px;
		white-space: nowrap;
	}
	.badge[data-tone="positive"] {
		background: var(--abt-positive-2);
		color: var(--color-budgetNumberPositive);
	}
	.badge[data-tone="neutral"] {
		background: var(--abt-ink-2);
		color: var(--abt-muted);
	}
	.badge[data-tone="warning"] {
		background: var(--abt-warning-2);
		color: var(--color-warningText);
	}
	.badge[data-tone="negative"] {
		background: var(--abt-danger-2);
		color: var(--color-errorText);
	}
</style>
