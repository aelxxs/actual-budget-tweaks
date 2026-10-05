<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title,
		open = $bindable(true),
		collapsible = true,
		card = true,
		tone,
		count,
		badges,
		trailing,
		onToggle,
		children,
	}: {
		title: string;
		open?: boolean;
		collapsible?: boolean;
		/** Wraps the body in the bordered card; turn off for content that brings its own layout. */
		card?: boolean;
		tone?: "error";
		count?: string | number;
		badges?: Snippet;
		/** Right-aligned header content before the chevron, e.g. a total. */
		trailing?: Snippet;
		onToggle?: (open: boolean) => void;
		children: Snippet;
	} = $props();

	function toggle() {
		open = !open;
		onToggle?.(open);
	}

	const expanded = $derived(!collapsible || open);
</script>

{#snippet headerContent()}
	<span class="title">{title}</span>
	{@render badges?.()}
	{#if count !== undefined}
		<span class="count">{count}</span>
	{/if}
	{#if trailing}
		<span class="trailing abt-privacy-number">{@render trailing()}</span>
	{/if}
	{#if collapsible}
		<svg
			class="chevron"
			data-open={open}
			width="12"
			height="12"
			viewBox="0 0 12 12"
			aria-hidden="true"
		>
			<polyline
				points="2,4 6,8 10,4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
{/snippet}

<section class="section">
	{#if collapsible}
		<button type="button" class="head" data-tone={tone} aria-expanded={open} onclick={toggle}>
			{@render headerContent()}
		</button>
	{:else}
		<div class="head" data-tone={tone}>
			{@render headerContent()}
		</div>
	{/if}
	{#if expanded}
		{#if card}
			<div class="card">{@render children()}</div>
		{:else}
			{@render children()}
		{/if}
	{/if}
</section>

<style>
	/* Spaced, not ruled: the cards already separate sections, and each title sits nearer its own card. */
	:global(.section) + .section {
		margin-top: 10px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 6px 12px;
		background: transparent;
		border: none;
		font: inherit;
		color: var(--abt-panel-accent);
		text-align: left;
	}
	button.head {
		cursor: pointer;
		transition: background 0.1s;
	}
	button.head:hover {
		background: var(--abt-panel-accent-muted);
	}
	.head[data-tone="error"] {
		color: var(--color-errorText, #e57373);
	}

	.title {
		flex: 1;
		min-width: 0;
		font-size: 10.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.7px;
	}

	.count {
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		opacity: 0.65;
	}

	.trailing {
		font-size: 11px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--color-pageText);
	}

	.chevron {
		flex-shrink: 0;
		opacity: 0.65;
		transition: transform 150ms ease;
	}
	.chevron[data-open="false"] {
		transform: rotate(-90deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}

	.section:last-child {
		padding-bottom: 12px;
	}

	.card {
		margin: 2px 12px 0;
		padding: 10px;
		border-radius: var(--abt-radius);
		border: 1px solid var(--abt-panel-border);
		background: var(--abt-panel-surface);
	}
</style>
