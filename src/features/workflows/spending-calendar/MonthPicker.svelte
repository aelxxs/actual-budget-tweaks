<script lang="ts">
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import { MAX_FUTURE_MONTHS, MONTH_NAMES, monthsFromNow } from "./month-data";

	let {
		year,
		month,
		open = $bindable(false),
		onpick,
	}: {
		year: number;
		month: number;
		open?: boolean;
		onpick: (year: number, month: number) => void;
	} = $props();

	let pickerYear = $state(new Date().getFullYear());
	let button = $state<HTMLElement | null>(null);
	let menu = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open || !menu || !button) return;
		positionPopover(menu, button);
		return onOutsideClick([menu, button], () => (open = false));
	});
</script>

<button
	type="button"
	class="title"
	title="Jump to month"
	aria-haspopup="dialog"
	aria-expanded={open}
	bind:this={button}
	onclick={() => {
		pickerYear = year;
		open = !open;
	}}
>
	{MONTH_NAMES[month]}
	{year}
	<svg
		class="title__chevron"
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg
	>
</button>

{#if open}
	{@const now = new Date()}
	<div class="picker" role="dialog" aria-label="Jump to month" bind:this={menu}>
		<div class="picker__head">
			<button
				type="button"
				class="picker__step"
				aria-label="Previous year"
				onclick={() => pickerYear--}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
				>
			</button>
			<span class="picker__year">{pickerYear}</span>
			<button
				type="button"
				class="picker__step"
				aria-label="Next year"
				disabled={monthsFromNow(pickerYear + 1, 0) > MAX_FUTURE_MONTHS}
				onclick={() => pickerYear++}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
				>
			</button>
		</div>
		<div class="picker__months">
			{#each MONTH_NAMES as name, m (name)}
				<button
					type="button"
					class="picker__month"
					class:is-active={pickerYear === year && m === month}
					class:is-current={pickerYear === now.getFullYear() && m === now.getMonth()}
					aria-current={pickerYear === year && m === month ? "date" : undefined}
					disabled={monthsFromNow(pickerYear, m) > MAX_FUTURE_MONTHS}
					onclick={() => {
						open = false;
						onpick(pickerYear, m);
					}}
				>
					{name.slice(0, 3)}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 0 -8px;
		padding: 2px 8px;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		font-size: 25px;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
		transition: background 0.1s;
	}
	.title:hover,
	.title[aria-expanded="true"] {
		background: var(--color-tableRowBackgroundHover);
	}
	.title__chevron {
		opacity: 0.45;
		transition: transform 0.15s;
	}
	.title[aria-expanded="true"] .title__chevron {
		transform: rotate(180deg);
	}

	.picker {
		position: fixed;
		z-index: 9999;
		width: 220px;
		padding: 8px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}
	.picker__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.picker__year {
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.picker__step {
		width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageText);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.6;
		transition:
			opacity 0.1s,
			background 0.1s;
	}
	.picker__step:hover:not(:disabled) {
		opacity: 1;
		background: var(--color-tableRowBackgroundHover);
	}
	.picker__step:disabled {
		opacity: 0.2;
		cursor: default;
	}
	.picker__months {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
	}
	.picker__month {
		padding: 7px 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageText);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.picker__month:hover:not(:disabled):not(.is-active) {
		background: var(--color-tableRowBackgroundHover);
	}
	.picker__month.is-current:not(.is-active) {
		box-shadow: inset 0 0 0 1px var(--color-tableBorder);
	}
	.picker__month.is-active {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 600;
	}
	.picker__month:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
