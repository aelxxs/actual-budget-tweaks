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
			onclick={() => select(tab.value)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.abt-tabs {
		display: flex;
		gap: 2px;
		padding: 10px 12px 0;
		flex-shrink: 0;
		background: var(--color-pageBackground);
		border-bottom: var(--border);
	}

	.abt-tabs__tab {
		appearance: none;
		font-family: inherit;
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 4px 10px 5px;
		border-radius: 6px 6px 0 0;
		border: var(--border);
		border-bottom: none;
		background: transparent;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.abt-tabs__tab:hover {
		color: var(--color-pageText);
	}

	.abt-tabs__tab--active {
		background: var(--color-tableBackground);
		color: var(--color-sidebarItemAccentSelected);
	}
</style>
