<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		name,
		meta,
		value,
		tone,
		strong = false,
		indent = false,
		dim = false,
		sensitive = false,
		leading,
		children,
	}: {
		name: string;
		meta?: string | null;
		value?: string;
		tone?: "positive" | "negative" | "warning" | "muted";
		strong?: boolean;
		indent?: boolean;
		dim?: boolean;
		/** Blurs the name in privacy mode too, e.g. payees. */
		sensitive?: boolean;
		leading?: Snippet;
		/** Extra content under the line, e.g. a progress bar. */
		children?: Snippet;
	} = $props();
</script>

<div class="panel-row" class:strong class:indent class:dim>
	<div class="line">
		{@render leading?.()}
		<span class="name" class:abt-privacy-number={sensitive}>
			{name}{#if meta}<span class="meta">{meta}</span>{/if}
		</span>
		{#if value !== undefined}
			<span class="value abt-privacy-number" data-tone={tone}>{value}</span>
		{/if}
	</div>
	{#if children}
		<div class="extra">{@render children()}</div>
	{/if}
</div>

<style>
	.panel-row {
		padding: 4px 0;
		font-size: 11px;
	}
	.panel-row:first-child {
		padding-top: 0;
	}
	.panel-row:last-child {
		padding-bottom: 0;
	}

	.line {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		margin-left: 5px;
		font-size: 10px;
		font-style: italic;
		opacity: 0.45;
	}

	.value {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		white-space: nowrap;
	}
	.value[data-tone="positive"] {
		color: var(--color-budgetNumberPositive, #4caf50);
	}
	.value[data-tone="negative"] {
		color: var(--color-errorText, #e57373);
	}
	.value[data-tone="warning"] {
		color: var(--color-warningText, #e0c590);
	}
	.value[data-tone="muted"] {
		opacity: 0.5;
	}

	.strong .name {
		font-weight: 600;
	}
	.indent .line {
		padding-left: 14px;
	}
	.indent .value {
		font-weight: 500;
	}
	.dim {
		opacity: 0.5;
	}

	.extra {
		margin-top: 4px;
	}
</style>
