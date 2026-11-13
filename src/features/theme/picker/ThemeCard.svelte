<script lang="ts">
	import { onOutsideClick } from "@lib/utilities/popover";
	import { Ellipsis, Moon, Sun } from "@lucide/svelte";
	import ThemeThumb from "./ThemeThumb.svelte";
	import type { Thumb } from "./thumbs";

	export type CardAction = {
		label: string;
		onselect?: () => void;
		href?: string;
		danger?: boolean;
	};

	const {
		name,
		thumb,
		mode,
		creator,
		active = false,
		loading = false,
		disabled = false,
		edited = [],
		actions = [],
		onselect,
	}: {
		name: string;
		thumb: Thumb;
		mode?: "light" | "dark";
		/** Shown for community themes, whose maker isn't ABT. */
		creator?: string;
		active?: boolean;
		loading?: boolean;
		disabled?: boolean;
		/** Color tokens the person has overridden on this theme. */
		edited?: string[];
		actions?: CardAction[];
		onselect: () => void;
	} = $props();

	let menuOpen = $state(false);
	let card: HTMLElement;

	$effect(() => {
		if (menuOpen) {
			return onOutsideClick(card, () => (menuOpen = false));
		}
	});
</script>

<div class="card" class:active class:loading bind:this={card}>
	<button
		type="button"
		class="frame"
		{disabled}
		title={name}
		aria-pressed={active}
		aria-label={name}
		onclick={onselect}
	>
		<ThemeThumb {thumb} />
		{#if loading}
			<span class="spinner" aria-label="Loading"></span>
		{:else if active}
			<span class="check" aria-hidden="true">✓</span>
		{/if}
	</button>

	<div class="row">
		<button type="button" class="label" {disabled} tabindex="-1" onclick={onselect}>
			<span class="name">{name}</span>
			{#if mode}
				<span class="mode" title={mode === "dark" ? "Dark theme" : "Light theme"}>
					{#if mode === "dark"}<Moon size={11} />{:else}<Sun size={11} />{/if}
				</span>
			{/if}
		</button>
		{#if actions.length}
			<button
				type="button"
				class="more abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
				aria-label="More for {name}"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
				onkeydown={(e) => e.key === "Escape" && (menuOpen = false)}
			>
				<Ellipsis size={14} />
			</button>
		{/if}
	</div>
	{#if creator || edited.length}
		<span class="meta">
			{#if creator}{creator}{/if}
			{#if edited.length}
				<span class="edited" title="Edited: {edited.join(', ')}"
					>{creator ? " · " : ""}{edited.length} edited</span
				>
			{/if}
		</span>
	{/if}

	{#if menuOpen}
		<div class="menu abt-popover abt-menu" role="menu">
			{#each actions as action (action.label)}
				{#if action.href}
					<a
						class="abt-menu__item"
						role="menuitem"
						href={action.href}
						target="_blank"
						rel="noopener noreferrer"
						onclick={() => (menuOpen = false)}>{action.label} ↗</a
					>
				{:else}
					<button
						type="button"
						class="abt-menu__item"
						class:danger={action.danger}
						role="menuitem"
						onclick={() => {
							menuOpen = false;
							action.onselect?.();
						}}>{action.label}</button
					>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		min-width: 0;
	}
	button {
		font: inherit;
		color: var(--abt-ink);
	}
	button:disabled {
		cursor: default;
	}
	.frame {
		position: relative;
		display: block;
		width: 100%;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: none;
		cursor: pointer;
		transition: border-color 0.12s;
	}
	.card:hover .frame {
		border-color: var(--abt-ink-5);
	}
	.active .frame {
		outline: 2px solid var(--abt-accent);
		outline-offset: 2px;
	}
	.frame:focus-visible {
		outline: 2px solid var(--abt-accent-4);
		outline-offset: 2px;
	}
	.check,
	.spinner {
		position: absolute;
		top: var(--abt-space-2);
		right: var(--abt-space-2);
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: var(--abt-radius-pill);
	}
	.check {
		background: var(--abt-accent);
		color: var(--color-buttonPrimaryText, white);
		font-size: var(--abt-text-xs);
		font-weight: 700;
	}
	.spinner {
		border: 2px solid var(--abt-ink-4);
		border-top-color: var(--abt-accent);
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.row {
		display: flex;
		align-items: center;
		min-width: 0;
		height: 20px;
	}
	.label {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--abt-space-2);
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
	}
	.name {
		overflow: hidden;
		font-size: var(--abt-text-sm);
		font-weight: 500;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.mode {
		display: inline-flex;
		flex: none;
		color: var(--abt-subtle);
	}
	.mode :global(svg) {
		display: block;
	}
	.meta {
		overflow: hidden;
		margin-top: -2px;
		font-size: var(--abt-text-xs);
		color: var(--abt-soft);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.edited {
		color: var(--abt-accent-text);
	}
	/* Shown on hover or focus, so a grid of cards stays quiet. */
	.more {
		flex: none;
		margin-right: -4px;
		opacity: 0;
		transition: opacity 0.1s;
	}
	.card:hover .more,
	.card:focus-within .more,
	.more[aria-expanded="true"] {
		opacity: 1;
	}
	.menu {
		position: absolute;
		z-index: 20;
		top: 100%;
		right: 0;
		min-width: 180px;
		margin-top: var(--abt-space-1);
	}
	.menu .danger {
		color: var(--color-errorText);
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
</style>
