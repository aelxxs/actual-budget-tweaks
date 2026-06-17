<script lang="ts">
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
</script>

<div class="rhp-row">
	{#each options as opt}
		<button
			class="rhp-option"
			class:is-active={selected === opt.value}
			onclick={() => pick(opt.value)}
		>
			<div class="rhp-preview">
				<div class="rhp-header"></div>
				{#each { length: PREVIEW_ROWS } as _}
					<div class="rhp-tr" style="height: {opt.rowPx}px;">
						<div class="rhp-dot"></div>
						<div class="rhp-bar"></div>
						<div class="rhp-num"></div>
					</div>
				{/each}
			</div>
			<span class="rhp-label">{opt.label}</span>
		</button>
	{/each}
</div>

<style>
	.rhp-row {
		display: flex;
		gap: 6px;
	}

	.rhp-option {
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

	.rhp-option:hover:not(.is-active) {
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent);
	}

	.rhp-option.is-active {
		border-color: var(--color-sidebarItemAccentSelected);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
	}

	.rhp-preview {
		width: 80px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 4px;
		border: 1px solid var(--color-tableBorder);
		background: var(--color-tableBackground);
	}

	.rhp-option.is-active .rhp-preview {
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent);
	}

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

	.rhp-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-pageTextSubdued);
		font-weight: 600;
	}

	.rhp-option.is-active .rhp-label {
		color: var(--color-sidebarItemAccentSelected);
	}
</style>
