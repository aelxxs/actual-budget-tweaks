<script lang="ts">
	import { dockInsightsTrigger, openInsights } from "@features/workflows/template-plan";
	import { templatePlanState } from "@features/workflows/template-plan/state.svelte";
	import MonthPicker from "@lib/components/MonthPicker.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { onMount } from "svelte";
	import {
		addMonths,
		currentMonth,
		latestStart,
		loadMonthMarks,
		monthKey,
		parseMonth,
		setMonthCount,
		showMonth,
	} from "./native";
	import { budgetNav } from "./state.svelte";

	let pickerOpen = $state(false);

	const start = $derived(budgetNav.months[0] ?? null);
	const parsed = $derived(start ? parseMonth(start) : null);
	const span = $derived(budgetNav.months.length);
	const counts = $derived(Array.from({ length: budgetNav.displayMax }, (_, i) => i + 1));
	const maxStart = latestStart();
	// "YYYY-MM" keys compare correctly as strings.
	const pastCap = (key: string) => key > maxStart;

	onMount(dockInsightsTrigger);

	function shift(delta: number) {
		if (!start) return;
		const next = addMonths(start, delta);
		if (!pastCap(next)) void showMonth(next);
	}
</script>

<div class="bmh">
	{#if parsed}
		<button
			type="button"
			class="bmh__chip"
			disabled={start === currentMonth()}
			onclick={() => showMonth(currentMonth())}>Today</button
		>
		<!-- Arrows sit together ahead of the title so its changing width never moves them. -->
		<div class="bmh__arrows">
			<button
				type="button"
				class="bmh__icon"
				title="Previous month"
				aria-label="Previous month"
				onclick={() => shift(-1)}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
				>
			</button>
			<button
				type="button"
				class="bmh__icon"
				title="Next month"
				aria-label="Next month"
				disabled={!start || pastCap(addMonths(start, 1))}
				onclick={() => shift(1)}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
				>
			</button>
		</div>
		<MonthPicker
			year={parsed.year}
			month={parsed.month}
			{span}
			variant="compact"
			bind:open={pickerOpen}
			onpick={(y, m) => showMonth(monthKey(y, m))}
			loadMarks={loadMonthMarks}
			isDisabled={(y, m) => pastCap(monthKey(y, m))}
		/>
	{/if}
	<div class="bmh__end">
		{#if counts.length > 1}
			<div class="bmh__seg" role="group" aria-label="Months shown">
				<span class="bmh__seg-label">Months</span>
				{#each counts as n (n)}
					<button
						type="button"
						class:is-active={n === span}
						aria-pressed={n === span}
						title={n === 1 ? "Show 1 month" : `Show ${n} months`}
						onclick={() => setMonthCount(n)}>{n}</button
					>
				{/each}
			</div>
		{/if}
		{#if templatePlanState.triggerShown}
			<button
				type="button"
				class="bmh__insights"
				title="Open insights"
				aria-label="Open insights"
				onclick={openInsights}
			>
				<Icon name="layout" size={14} />
				Insights
			</button>
		{/if}
	</div>
</div>

<style>
	.bmh {
		--bmh-radius: var(--border-radius, 6px);
		--bmh-inner-radius: max(0px, calc(var(--bmh-radius) - 3px));
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		box-sizing: border-box;
		min-height: var(--abt-panel-header-height);
		padding: 0 20px;
		border-bottom: 1px solid var(--abt-panel-border);
		color: var(--color-pageText);
	}

	.bmh__arrows {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.bmh__end {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-left: auto;
	}

	.bmh__icon {
		width: 30px;
		height: 30px;
		border: none;
		border-radius: var(--bmh-radius);
		background: none;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		display: grid;
		place-items: center;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.bmh__icon:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.bmh__icon:hover:not(:disabled) {
		background: var(--color-tableRowBackgroundHover);
		color: var(--color-pageText);
	}

	.bmh__chip {
		height: 30px;
		padding: 0 12px;
		border: 1px solid color-mix(in srgb, var(--color-pageText) 22%, transparent);
		border-radius: 999px;
		background: none;
		color: var(--color-pageText);
		font: inherit;
		font-size: 12px;
		font-weight: 550;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.1s,
			border-color 0.1s;
	}

	.bmh__chip:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-pageText) 8%, transparent);
		border-color: color-mix(in srgb, var(--color-pageText) 35%, transparent);
	}

	.bmh__chip:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.bmh__insights {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 30px;
		padding: 0 12px 0 10px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--bmh-radius);
		background: none;
		color: var(--color-pageText);
		font: inherit;
		font-size: 12.5px;
		font-weight: 550;
		white-space: nowrap;
		cursor: pointer;
		transition: background 0.1s;
	}

	.bmh__insights:hover {
		background: var(--color-tableRowBackgroundHover);
	}

	.bmh__seg {
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		height: 30px;
		padding: 2px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--bmh-radius);
	}

	.bmh__seg-label {
		padding: 0 8px 0 6px;
		font-size: 11.5px;
		color: var(--color-pageTextSubdued);
	}

	.bmh__seg button {
		height: 100%;
		padding: 0 11px;
		border: none;
		border-radius: var(--bmh-inner-radius);
		background: none;
		color: var(--color-pageTextSubdued);
		font: inherit;
		font-size: 12.5px;
		font-weight: 550;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.bmh__seg button:hover:not(.is-active) {
		color: var(--color-pageText);
	}

	.bmh__seg button.is-active {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 24%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 650;
	}
</style>
