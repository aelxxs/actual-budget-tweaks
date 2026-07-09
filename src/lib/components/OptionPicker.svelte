<script lang="ts" generics="T extends string">
	import type { Snippet } from "svelte";

	let {
		options,
		selected,
		onPick,
		preview,
	}: {
		options: { value: T; label: string }[];
		selected: T;
		onPick: (value: T) => void;
		preview: Snippet<[{ value: T; label: string; active: boolean }]>;
	} = $props();
</script>

<div class="op-row">
	{#each options as opt (opt.value)}
		<button
			type="button"
			class="op-option"
			class:is-active={selected === opt.value}
			onclick={() => onPick(opt.value)}
		>
			<div class="op-preview">
				{@render preview({ value: opt.value, label: opt.label, active: selected === opt.value })}
			</div>
			<span class="op-label">{opt.label}</span>
		</button>
	{/each}
</div>

<style>
	.op-row {
		display: flex;
		gap: 6px;
	}

	.op-option {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		padding: 8px 6px;
		background: var(--color-cardBackground);
		border: 1px solid var(--color-tableBorder);
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.op-option:hover:not(.is-active) {
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent);
	}

	.op-option.is-active {
		border-color: var(--color-sidebarItemAccentSelected);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
	}

	.op-preview {
		width: 80px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 4px;
		border: 1px solid var(--color-tableBorder);
		background: var(--color-tableBackground);
	}

	.op-option.is-active .op-preview {
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent);
	}

	.op-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-pageTextSubdued);
		font-weight: 600;
	}

	.op-option.is-active .op-label {
		color: var(--color-sidebarItemAccentSelected);
	}
</style>
