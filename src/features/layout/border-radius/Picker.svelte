<script lang="ts">
	import { onMount } from "svelte";
	import { getValue, setValue } from "@lib/utilities/store";

	let { ctx }: { ctx: { key: string; defaultValue: string } } = $props();

	const options = [
		{ value: "0rem", label: "None" },
		{ value: "0.25rem", label: "Small" },
		{ value: "0.5rem", label: "Medium" },
		{ value: "0.75rem", label: "Rounder" },
		{ value: "1rem", label: "Large" },
		{ value: "1.5rem", label: "Pill" },
	];

	let selected = $state(ctx.defaultValue);

	onMount(async () => {
		selected = (await getValue<string>(ctx.key, ctx.defaultValue)) as string;
	});

	async function pick(value: string) {
		selected = value;
		await setValue(ctx.key, value);
		document.documentElement.style.setProperty("--border-radius", value);
	}
</script>

<div class="rp-grid">
	{#each options as opt (opt.value)}
		<button
			class="rp-option"
			class:is-active={selected === opt.value}
			onclick={() => pick(opt.value)}
			title={opt.value}
		>
			<div class="rp-preview">
				<div class="rp-box" style="border-top-right-radius: {opt.value}"></div>
			</div>
			<span class="rp-label">{opt.label}</span>
		</button>
	{/each}
</div>

<style>
	.rp-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.rp-option {
		flex: 1;
		min-width: 64px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px 8px 8px;
		background: var(--color-cardBackground);
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		cursor: pointer;
		font-family: inherit;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.rp-option:hover:not(.is-active) {
		border-color: var(--abt-accent-3);
	}

	.rp-option.is-active {
		border-color: var(--abt-accent);
		box-shadow: 0 0 0 2px var(--abt-accent-2);
		background: color-mix(in srgb, var(--abt-accent) 5%, var(--color-cardBackground));
	}

	.rp-preview {
		width: 44px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.rp-box {
		width: 2.75rem;
		height: 2.5rem;
		background: var(--abt-accent-2);
		border-top: 2px solid var(--abt-accent-4);
		border-right: 2px solid var(--abt-accent-4);
		border-bottom-left-radius: 0.15rem;
		transition: background 0.15s;
	}

	.rp-option.is-active .rp-box {
		background: var(--abt-accent-3);
		border-color: var(--abt-accent);
	}

	.rp-label {
		font-size: var(--abt-text-2xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-pageTextSubdued);
		font-weight: 600;
		white-space: nowrap;
	}

	.rp-option.is-active .rp-label {
		color: var(--abt-accent);
	}
</style>
