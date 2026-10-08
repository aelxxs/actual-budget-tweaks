<script lang="ts">
	import type { Snippet } from "svelte";

	let { tone, children }: { tone: "positive" | "warning" | "negative"; children: Snippet } =
		$props();
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
		background: color-mix(in srgb, var(--color-budgetNumberPositive, #4caf50) 15%, transparent);
		color: var(--color-budgetNumberPositive, #4caf50);
	}
	.badge[data-tone="warning"] {
		background: color-mix(in srgb, var(--color-warningText, #e0c590) 15%, transparent);
		color: var(--color-warningText, #e0c590);
	}
	.badge[data-tone="negative"] {
		background: color-mix(in srgb, var(--color-errorText, #e57373) 15%, transparent);
		color: var(--color-errorText, #e57373);
	}
</style>
