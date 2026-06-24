<script lang="ts">
	import { onMount } from "svelte";
	import { applyGlobalCSS } from "@lib/utilities/dom";
	import { getValue, setValue } from "@lib/utilities/store";
	import { bgPatterns } from "./data";

	let { ctx }: { ctx: { key: string; defaultValue: string; css: (v: string) => string } } = $props();

	const options = Object.keys(bgPatterns);

	let selected = $state(ctx.defaultValue);

	onMount(async () => {
		selected = (await getValue<string>(ctx.key, ctx.defaultValue)) as string;
	});

	async function pick(value: string) {
		selected = value;
		await setValue(ctx.key, value);
		applyGlobalCSS(ctx.css(value), ctx.key);
	}
</script>

<div class="bpp-grid">
	{#each options as name}
		<button
			class="bpp-option"
			class:is-active={selected === name}
			onclick={() => pick(name)}
			title={name}
		>
			<div class="bpp-swatch" style={bgPatterns[name]}></div>
			<span class="bpp-label">{name}</span>
		</button>
	{/each}
</div>

<style>
	.bpp-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}

	.bpp-option {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid var(--color-tableBorder);
		cursor: pointer;
		font-family: inherit;
		padding: 0;
		background: none;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
		text-align: left;
	}

	.bpp-option:hover:not(.is-active) {
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent);
	}

	.bpp-option.is-active {
		border-color: var(--color-sidebarItemAccentSelected);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
	}

	.bpp-swatch {
		height: 52px;
		background-color: var(--ctp-crust);
	}

	.bpp-label {
		display: block;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		color: var(--color-pageTextSubdued);
		padding: 5px 8px;
		background: var(--color-cardBackground);
		border-top: 1px solid var(--color-tableBorder);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bpp-option.is-active .bpp-label {
		color: var(--color-sidebarItemAccentSelected);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 6%, var(--color-cardBackground));
		border-top-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 30%, transparent);
	}
</style>
