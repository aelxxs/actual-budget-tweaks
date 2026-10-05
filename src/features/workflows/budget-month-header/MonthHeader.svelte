<script lang="ts">
	import { openInsights } from "@features/workflows/template-plan";
	import { templatePlanState } from "@features/workflows/template-plan/state.svelte";
	import MonthPicker from "@lib/components/MonthPicker.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import {
		addMonths,
		currentMonth,
		loadBounds,
		loadMonthMarks,
		monthKey,
		parseMonth,
		setMonthCount,
		showMonth,
		validStart,
		type MonthBounds,
	} from "./native";
	import { budgetNav } from "./state.svelte";

	let pickerOpen = $state(false);

	const start = $derived(budgetNav.months[0] ?? null);
	const parsed = $derived(start ? parseMonth(start) : null);
	const span = $derived(budgetNav.months.length);
	const counts = $derived(Array.from({ length: budgetNav.displayMax }, (_, i) => i + 1));
	let bounds = $state<MonthBounds>({ start: "0000-01", end: addMonths(currentMonth(), 12) });
	// "YYYY-MM" keys compare correctly as strings.
	const outOfBounds = (key: string) => key < bounds.start || key > bounds.end;

	// Budgets for new months are created as they're reached, so the bounds can grow.
	$effect(() => {
		if (!start) return;
		let stale = false;
		void loadBounds().then((b) => {
			if (!stale) bounds = b;
		});
		return () => {
			stale = true;
		};
	});

	// Showing more months near the budget's end would run past it; start earlier instead.
	async function setCount(count: number) {
		const from = start;
		await setMonthCount(count);
		if (!from) return;
		const next = validStart(from, count, bounds);
		if (next !== from) void showMonth(next);
	}

	function go(key: string) {
		const next = validStart(key, span, bounds);
		if (next !== start) void showMonth(next);
	}
</script>

<div class="bmh abt-repel abt-controls-quiet">
	<div class="abt-cluster abt-gap-4">
		{#if parsed}
			<button
				type="button"
				class="bmh__today abt-btn abt-btn--pill"
				disabled={start === currentMonth()}
				onclick={() => go(currentMonth())}>Today</button
			>
			<!-- Arrows sit together ahead of the title so its changing width never moves them. -->
			<div class="abt-btn-group">
				<button
					type="button"
					class="abt-btn abt-btn--icon"
					title="Previous month"
					aria-label="Previous month"
					disabled={!start || validStart(addMonths(start, -1), span, bounds) === start}
					onclick={() => start && go(addMonths(start, -1))}
				>
					<Icon name="chevronLeft" size={16} />
				</button>
				<button
					type="button"
					class="abt-btn abt-btn--icon"
					title="Next month"
					aria-label="Next month"
					disabled={!start || validStart(addMonths(start, 1), span, bounds) === start}
					onclick={() => start && go(addMonths(start, 1))}
				>
					<Icon name="chevronRight" size={16} />
				</button>
			</div>
			<MonthPicker
				year={parsed.year}
				month={parsed.month}
				{span}
				variant="compact"
				bind:open={pickerOpen}
				onpick={(y, m) => go(monthKey(y, m))}
				loadMarks={loadMonthMarks}
				isDisabled={(y, m) => outOfBounds(monthKey(y, m))}
			/>
		{/if}
	</div>
	<div class="bmh__end abt-cluster abt-gap-4">
		<!-- Other features (the category filter) mount their controls here. -->
		<div class="bmh__slot" data-abt-month-header-slot></div>
		{#if counts.length > 1}
			<div class="abt-seg" role="group" aria-label="Months shown">
				<span class="abt-seg__label">Months</span>
				{#each counts as n (n)}
					<button
						type="button"
						aria-pressed={n === span}
						title={n === 1 ? "Show 1 month" : `Show ${n} months`}
						onclick={() => setCount(n)}>{n}</button
					>
				{/each}
			</div>
		{/if}
		{#if templatePlanState.triggerShown}
			<!-- The header's one action that opens something, so it carries the accent. -->
			<button
				type="button"
				class="abt-btn abt-tone-accent"
				title="Open insights"
				aria-label="Open insights"
				onclick={() => openInsights()}
			>
				<Icon name="layout" size={14} />
				Insights
			</button>
		{/if}
	</div>
</div>

<style>
	/* Matches the side panel header beside it, border included. */
	.bmh {
		/* Sized by its own width (the side panel narrows it), for the compact rules below. */
		container: bmh / inline-size;
		flex-wrap: wrap;
		row-gap: var(--abt-space-3);
		box-sizing: border-box;
		min-height: var(--abt-panel-header-height);
		/* Room above and below a second line, when the controls don't fit on one. */
		padding: var(--abt-space-3) 13px;
		border-bottom: 1px solid var(--abt-panel-border);
		color: var(--color-pageText);
	}

	.bmh__slot {
		display: contents;
	}

	/* Stays right-aligned when it wraps onto its own line. */
	.bmh__end {
		margin-left: auto;
	}

	@container bmh (max-width: 820px) {
		.bmh .abt-seg__label {
			display: none;
		}
	}

	/* Already on this month: plain text, so it doesn't read as a live button. */
	.bmh__today:disabled {
		opacity: 1;
		border-color: transparent;
		background: none;
		color: var(--color-pageTextSubdued);
	}
</style>
