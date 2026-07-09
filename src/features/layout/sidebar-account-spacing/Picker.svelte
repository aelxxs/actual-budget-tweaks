<script lang="ts">
	import OptionPicker from "@lib/components/OptionPicker.svelte";
	import { onMount } from "svelte";
	import { applyGlobalCSS } from "@lib/utilities/dom";
	import { getValue, setValue } from "@lib/utilities/store";

	let { ctx }: { ctx: { key: string; defaultValue: string; css: (v: string) => string } } = $props();

	const options = [
		{ value: ".05rem", label: "Slim" },
		{ value: ".15rem", label: "Normal" },
		{ value: ".25rem", label: "Relaxed" },
	];

	// Real values (.05rem/.15rem/.25rem) are too close together to read at this
	// scale — exaggerated here just to make the three options distinguishable.
	const PREVIEW_GAP: Record<string, string> = {
		".05rem": "2px",
		".15rem": "6px",
		".25rem": "10px",
	};

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
</script>

<OptionPicker {options} {selected} onPick={pick}>
	{#snippet preview({ value })}
		<div class="sp-rows" style="gap: {PREVIEW_GAP[value] ?? '4px'}">
			{#each { length: PREVIEW_ROWS } as _}
				<div class="sp-row">
					<div class="sp-dot"></div>
					<div class="sp-bar"></div>
				</div>
			{/each}
		</div>
	{/snippet}
</OptionPicker>

<style>
	.sp-rows {
		display: flex;
		flex-direction: column;
		padding: 6px 5px;
	}

	.sp-row {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.sp-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
		background: color-mix(in srgb, var(--color-pageTextSubdued) 35%, transparent);
	}

	.sp-bar {
		flex: 1;
		height: 2.5px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-tableText) 25%, transparent);
	}
</style>
