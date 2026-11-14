<script lang="ts">
	import type { Snippet } from "svelte";
	import CategoryIcon from "@lib/components/CategoryIcon.svelte";

	let {
		name,
		meta,
		count,
		value,
		tone,
		strong = false,
		indent = false,
		dim = false,
		sensitive = false,
		leading,
		categoryId,
		label,
		children,
	}: {
		name: string;
		meta?: string | null;
		/** Folded repeats, shown as a "×n" chip after the name when over one. */
		count?: number;
		value?: string;
		tone?: "positive" | "negative" | "warning" | "muted";
		strong?: boolean;
		indent?: boolean;
		dim?: boolean;
		/** Blurs the name in privacy mode too, e.g. payees. */
		sensitive?: boolean;
		leading?: Snippet;
		/** Shows the category's image icon, if it has one, where an emoji in its name would sit. */
		categoryId?: string | null;
		/** Replaces the name's text, e.g. to put icons inside it; `name` still sets nothing else. */
		label?: Snippet;
		/** Extra content under the line, e.g. a progress bar. */
		children?: Snippet;
	} = $props();
</script>

<div class="panel-row" class:strong class:indent class:dim class:counted={!!count && count > 1}>
	<div class="line">
		{@render leading?.()}
		<span class="name" class:abt-privacy-number={sensitive}>
			{#if label}{@render label()}{:else}{#if categoryId}<CategoryIcon
						id={categoryId}
					/>{/if}{name}{/if}{#if meta}<span class="meta">{meta}</span>{/if}
		</span>
		{#if count && count > 1}
			<span class="abt-count">×{count}</span>
		{/if}
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
		padding: var(--abt-space-2) 0;
		font-size: var(--abt-text-sm);
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
		gap: var(--abt-space-3);
	}

	/* Sized and spaced as an emoji and the space after it. */
	.name :global(.category-icon) {
		width: 1.2em !important;
		height: 1.2em !important;
		margin-right: 0.15em;
		vertical-align: -0.2em;
	}
	.name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* The chip sits right after the name, as in the calendar; the value keeps to the end. */
	.counted .name {
		flex: 0 1 auto;
	}
	.counted .value {
		margin-left: auto;
	}

	.meta {
		margin-left: 5px;
		font-size: var(--abt-text-xs);
		opacity: 0.45;
	}

	.value {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		white-space: nowrap;
	}
	.value[data-tone="positive"] {
		color: var(--color-budgetNumberPositive);
	}
	.value[data-tone="negative"] {
		color: var(--color-errorText);
	}
	.value[data-tone="warning"] {
		color: var(--color-warningText);
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
		margin-top: var(--abt-space-2);
	}
</style>
