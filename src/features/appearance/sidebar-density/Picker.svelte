<script lang="ts">
	import OptionPicker from "@lib/components/OptionPicker.svelte";

	let {
		options,
		selected,
		onPick,
	}: {
		options: { value: string; label: string }[];
		selected: string;
		onPick: (value: string) => void;
	} = $props();

	// Real values (.05rem/.15rem/.25rem) are too close together to read at this
	// scale — exaggerated here just to make the three options distinguishable.
	const PREVIEW_GAP: Record<string, string> = {
		".05rem": "2px",
		".15rem": "6px",
		".25rem": "10px",
	};

	const PREVIEW_ROWS = 4;
</script>

<OptionPicker {options} {selected} {onPick}>
	{#snippet preview({ value })}
		<div class="sp-rows" style="gap: {PREVIEW_GAP[value] ?? '4px'}">
			{#each { length: PREVIEW_ROWS } as _, i (i)}
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
		gap: var(--abt-space-2);
		flex-shrink: 0;
	}

	.sp-dot {
		width: 5px;
		height: 5px;
		border-radius: var(--abt-radius-pill);
		flex-shrink: 0;
		background: var(--abt-ink-4);
	}

	.sp-bar {
		flex: 1;
		height: 2.5px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-tableText) 25%, transparent);
	}
</style>
