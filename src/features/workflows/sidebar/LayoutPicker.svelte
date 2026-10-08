<script lang="ts">
	import OptionPicker from "@lib/components/OptionPicker.svelte";
	import { getValue, setValue } from "@lib/utilities/store";
	import { onMount } from "svelte";
	import { toLayout, type SidebarLayout } from "./lib/layout";

	let { ctx }: { ctx: { key: string; defaultValue: string } } = $props();

	const options: { value: SidebarLayout; label: string }[] = [
		{ value: "standard", label: "Standard" },
		{ value: "split", label: "Split" },
	];

	const PREVIEW_ROWS = 4;

	let selected = $state<SidebarLayout>(toLayout(ctx.defaultValue));

	onMount(async () => {
		selected = toLayout(await getValue<unknown>(ctx.key, ctx.defaultValue));
	});

	async function pick(value: SidebarLayout) {
		selected = value;
		await setValue(ctx.key, value);
	}
</script>

<OptionPicker {options} {selected} onPick={pick}>
	{#snippet preview({ value })}
		<div class="lp-frame">
			{#if value === "split"}
				<div class="lp-bar">
					{#each { length: PREVIEW_ROWS } as _, i (i)}
						<div class="lp-dot"></div>
					{/each}
				</div>
			{/if}
			<div class="lp-panel">
				{#each { length: PREVIEW_ROWS } as _, i (i)}
					<div class="lp-row">
						{#if value === "standard"}<div class="lp-dot"></div>{/if}
						<div class="lp-line"></div>
					</div>
				{/each}
			</div>
		</div>
	{/snippet}
</OptionPicker>

<style>
	.lp-frame {
		display: flex;
		height: 100%;
		padding: 6px 5px;
		gap: 4px;
	}

	.lp-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		padding-right: 4px;
		border-right: 1px solid color-mix(in srgb, var(--color-tableText) 15%, transparent);
	}

	.lp-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.lp-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.lp-dot {
		width: 5px;
		height: 5px;
		border-radius: var(--abt-radius-pill);
		flex-shrink: 0;
		background: color-mix(in srgb, var(--color-pageTextSubdued) 35%, transparent);
	}

	.lp-line {
		flex: 1;
		height: 2.5px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-tableText) 25%, transparent);
	}
</style>
