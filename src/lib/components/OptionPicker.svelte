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
		border-radius: var(--abt-radius);
		cursor: pointer;
		font-family: inherit;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.op-option:hover:not(.is-active) {
		border-color: var(--abt-accent-3);
	}

	.op-option.is-active {
		border-color: var(--abt-accent);
		box-shadow: 0 0 0 2px var(--abt-accent-2);
	}

	.op-preview {
		width: 80px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--abt-radius-sm);
		border: 1px solid var(--color-tableBorder);
		background: var(--color-tableBackground);
	}

	.op-option.is-active .op-preview {
		border-color: var(--abt-accent-3);
	}

	.op-label {
		font-size: var(--abt-text-2xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-pageTextSubdued);
		font-weight: 600;
	}

	.op-option.is-active .op-label {
		color: var(--abt-accent);
	}
</style>
