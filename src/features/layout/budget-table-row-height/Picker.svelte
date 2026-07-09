<script lang="ts">
	import OptionPicker from "@lib/components/OptionPicker.svelte";
	import { onMount } from "svelte";
	import { applyGlobalCSS } from "@lib/utilities/dom";
	import { getValue, setValue } from "@lib/utilities/store";

	let { ctx }: { ctx: { key: string; defaultValue: string; css: (v: string) => string } } = $props();

	const options = [
		{ value: "1.75rem", label: "X-Slim", rowPx: 11 },
		{ value: "2rem", label: "Slim", rowPx: 14 },
		{ value: "2.25rem", label: "Normal", rowPx: 17 },
		{ value: "2.5rem", label: "Relaxed", rowPx: 20 },
	];

	const PREVIEW_ROWS = 4;

	let selected = $state(ctx.defaultValue);

	onMount(async () => {
		selected = (await getValue<string>(ctx.key, ctx.defaultValue)) as string;
	});

	async function pick(value: string) {
		selected = value;
		await setValue(ctx.key, value);
		applyGlobalCSS(ctx.css(value), ctx.key);
	}

	function rowPxFor(value: string): number {
		return options.find((o) => o.value === value)?.rowPx ?? 14;
	}
</script>

<OptionPicker {options} {selected} onPick={pick}>
	{#snippet preview({ value })}
		<div class="rhp-header"></div>
		{#each { length: PREVIEW_ROWS } as _}
			<div class="rhp-tr" style="height: {rowPxFor(value)}px;">
				<div class="rhp-dot"></div>
				<div class="rhp-bar"></div>
				<div class="rhp-num"></div>
			</div>
		{/each}
	{/snippet}
</OptionPicker>

<style>
	.rhp-header {
		height: 9px;
		flex-shrink: 0;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 18%, var(--color-tableHeaderBackground));
		border-bottom: 1px solid var(--color-tableBorder);
	}

	.rhp-tr {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 5px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-tableBorder) 50%, transparent);
		flex-shrink: 0;
	}

	.rhp-tr:last-child {
		border-bottom: none;
	}

	.rhp-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
		background: color-mix(in srgb, var(--color-pageTextSubdued) 35%, transparent);
	}

	.rhp-bar {
		flex: 1;
		height: 2.5px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-tableText) 25%, transparent);
	}

	.rhp-num {
		width: 12px;
		height: 2.5px;
		border-radius: 2px;
		flex-shrink: 0;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 45%, transparent);
	}
</style>
