<script lang="ts" generics="T extends string">
	import type { Icon } from "lucide-svelte";
	import type { Snippet } from "svelte";

	let {
		tabs,
		value = $bindable(),
		onChange,
		trailing,
	}: {
		tabs: { value: T; label: string; icon?: typeof Icon }[];
		value: T;
		onChange?: (value: T) => void;
		/** Actions at the row's end, such as a close button. */
		trailing?: Snippet;
	} = $props();

	function select(tab: T) {
		if (tab === value) return;
		value = tab;
		onChange?.(tab);
	}
</script>

<div class="abt-tabs">
	{#each tabs as tab (tab.value)}
		<button
			type="button"
			class="abt-tabs__tab"
			class:abt-tabs__tab--active={value === tab.value}
			aria-pressed={value === tab.value}
			onclick={() => select(tab.value)}
		>
			{#if tab.icon}
				<tab.icon size={13} />
			{/if}
			{tab.label}
		</button>
	{/each}
	{#if trailing}
		<div class="abt-tabs__trailing">{@render trailing()}</div>
	{/if}
</div>

<style>
	/* Underline tabs on the panel's divider, so they read as part of the panel. Hosts on another
	   surface (dialogs, popovers) set --abt-tabs-bg and --abt-tabs-pad. */
	.abt-tabs {
		display: flex;
		gap: var(--abt-space-5);
		padding: 0 var(--abt-tabs-pad, var(--abt-space-4));
		flex-shrink: 0;
		background: var(--abt-tabs-bg, var(--color-pageBackground));
		border-bottom: 1px solid var(--abt-panel-border);
	}

	.abt-tabs__trailing {
		display: flex;
		align-items: center;
		margin-left: auto;
	}

	.abt-tabs__tab {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		appearance: none;
		margin-bottom: -1px;
		padding: 10px 1px 9px;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-base);
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
		transition:
			color 0.12s,
			border-color 0.12s;
	}

	.abt-tabs__tab:hover {
		color: var(--color-pageText);
	}

	.abt-tabs__tab:focus-visible {
		outline: 2px solid var(--abt-accent-4);
		outline-offset: -2px;
	}

	.abt-tabs__tab--active,
	.abt-tabs__tab--active:hover {
		color: var(--abt-selected-fg);
		border-bottom-color: var(--abt-selected-fg);
	}
</style>
