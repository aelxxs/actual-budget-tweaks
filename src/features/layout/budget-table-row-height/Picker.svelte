<script lang="ts">
	import OptionPicker from "@lib/components/OptionPicker.svelte";
	import { onMount } from "svelte";
	import { applyGlobalCSS } from "@lib/utilities/dom";
	import { getValue, setValue } from "@lib/utilities/store";
	import { ROW_HEIGHT_OPTIONS } from "./options";

	let { ctx }: { ctx: { key: string; defaultValue: string; css: (v: string) => string } } =
		$props();

	const options = ROW_HEIGHT_OPTIONS;

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
		{#each { length: PREVIEW_ROWS } as _, i (i)}
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
		background: color-mix(in srgb, var(--abt-accent) 18%, var(--color-tableHeaderBackground));
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
		background: var(--abt-accent-4);
	}
</style>
