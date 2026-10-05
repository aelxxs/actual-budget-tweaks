<script lang="ts" generics="T extends string">
	let {
		tabs,
		value = $bindable(),
		onChange,
	}: {
		tabs: { value: T; label: string }[];
		value: T;
		onChange?: (value: T) => void;
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
			{tab.label}
		</button>
	{/each}
</div>

<style>
	/* Underline tabs on the panel's divider, so they read as part of the panel. */
	.abt-tabs {
		display: flex;
		gap: var(--abt-space-5);
		padding: 0 12px;
		flex-shrink: 0;
		background: var(--color-pageBackground);
		border-bottom: 1px solid var(--abt-panel-border);
	}

	.abt-tabs__tab {
		appearance: none;
		margin-bottom: -1px;
		padding: 10px 1px 9px;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-md);
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
		outline: 2px solid color-mix(in srgb, var(--abt-accent) 55%, transparent);
		outline-offset: -2px;
	}

	.abt-tabs__tab--active,
	.abt-tabs__tab--active:hover {
		color: var(--abt-selected-fg);
		border-bottom-color: var(--abt-selected-fg);
	}
</style>
