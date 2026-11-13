<script lang="ts">
	import { panelState } from "@features/core/side-panel/panel-state.svelte";
	import { openInsights } from "@features/workflows/template-plan";
	import { templatePlanState } from "@features/workflows/template-plan/state.svelte";
	import MonthPicker from "@lib/components/MonthPicker.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { onListChange, send } from "@lib/actual/actual-api";
	import { getValue, setValue } from "@lib/store";
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

	const MOST_KEY = "budget-month-count-most";

	let pickerOpen = $state(false);

	const start = $derived(budgetNav.months[0] ?? null);
	// The month last asked for, so clicks made while a big budget is still rendering add up.
	let target = $state<string | null>(null);
	const base = $derived(target ?? start);
	const parsed = $derived(start ? parseMonth(start) : null);
	const span = $derived(budgetNav.months.length);
	// Every count that has ever fit stays listed (remembered across visits), disabled while it doesn't
	// fit, so opening a panel or narrowing the window greys a count out instead of reshaping the header.
	let most = $state(1);
	void getValue<number>(MOST_KEY, 1).then((v) => (most = Math.max(most, v)));
	$effect(() => {
		if (budgetNav.displayMax > most) {
			most = budgetNav.displayMax;
			void setValue(MOST_KEY, most);
		}
	});
	const counts = $derived(
		Array.from({ length: Math.max(most, budgetNav.displayMax) }, (_, i) => i + 1),
	);
	// The count you picked; Actual shows fewer while they don't fit, and the pick is marked waiting.
	let chosen = $state<number | null>(null);
	void send<{ maxMonths?: number } | null>("load-global-prefs").then((p) => {
		chosen ??= p?.maxMonths ?? null;
	});
	const waiting = (n: number) => n === chosen && n !== span && n > budgetNav.displayMax;

	let bounds = $state<MonthBounds>({ start: "0000-01", end: addMonths(currentMonth(), 12) });
	// "YYYY-MM" keys compare correctly as strings.
	const outOfBounds = (key: string) => key < bounds.start || key > bounds.end;

	// Budgets for new months are created as they're reached, so the bounds can grow.
	let boundsSeq = 0;
	function reloadBounds() {
		const seq = ++boundsSeq;
		void loadBounds().then((b) => {
			if (seq === boundsSeq) {
				bounds = b;
			}
		});
	}
	$effect(() => {
		if (start) {
			reloadBounds();
		}
	});
	// Budgeting near the end of the range extends it (actualbudget/actual#9293).
	$effect(() => onListChange("budget-bounds", reloadBounds));

	// Showing more months near the budget's end would run past it; start earlier instead.
	async function setCount(count: number) {
		chosen = count;
		const from = start;
		await setMonthCount(count);
		if (!from) {
			return;
		}
		const next = validStart(from, count, bounds);
		if (next !== from) {
			void showMonth(next);
		}
	}

	const SQUEEZE_STEPS = 5;

	// Shortens the header a step at a time (see the squeeze rules below) until it fits on one
	// line, so it only wraps once nothing is left to shorten. Measured, as its content varies.
	function fitOneLine(node: HTMLElement) {
		const apply = (level: number) => {
			for (let i = 1; i <= SQUEEZE_STEPS; i++) {
				node.classList.toggle(`bmh--squeeze-${i}`, i <= level);
			}
		};
		const oneLine = () => {
			const first = node.firstElementChild?.getBoundingClientRect();
			const end = node.querySelector(".bmh__end")?.getBoundingClientRect();
			return !first || !end || end.top < first.bottom;
		};
		const fit = () => {
			let level = 0;
			apply(level);
			while (level < SQUEEZE_STEPS && !oneLine()) {
				apply(++level);
			}
		};
		const observer = new ResizeObserver(fit);
		observer.observe(node);
		for (const child of node.children) {
			observer.observe(child);
		}
		return () => observer.disconnect();
	}

	function go(key: string) {
		const next = validStart(key, span, bounds);
		if (next === base) {
			return;
		}
		target = next;
		void showMonth(next).finally(() => {
			if (target === next) {
				target = null;
			}
		});
	}
</script>

<div class="bmh abt-repel abt-controls-quiet" {@attach fitOneLine}>
	<div class="abt-cluster abt-gap-4">
		{#if parsed}
			<button
				type="button"
				class="bmh__today abt-btn abt-btn--pill"
				title="Today"
				aria-label="Today"
				disabled={start === currentMonth()}
				onclick={() => go(currentMonth())}
				><span class="bmh__text">Today</span><span class="bmh__icon"
					><Icon name="calendar" size={16} /></span
				></button
			>
			<!-- Arrows sit together ahead of the title so its changing width never moves them. -->
			<div class="abt-btn-group">
				<button
					type="button"
					class="abt-btn abt-btn--icon"
					title="Previous month"
					aria-label="Previous month"
					disabled={!base || validStart(addMonths(base, -1), span, bounds) === base}
					onclick={() => base && go(addMonths(base, -1))}
				>
					<Icon name="chevronLeft" size={16} />
				</button>
				<button
					type="button"
					class="abt-btn abt-btn--icon"
					title="Next month"
					aria-label="Next month"
					disabled={!base || validStart(addMonths(base, 1), span, bounds) === base}
					onclick={() => base && go(addMonths(base, 1))}
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
				minYear={parseMonth(bounds.start).year}
				maxYear={parseMonth(bounds.end).year}
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
						class:bmh__waiting={waiting(n)}
						aria-pressed={n === span}
						disabled={n > budgetNav.displayMax}
						title={waiting(n)
							? `You picked ${n} months`
							: n > budgetNav.displayMax
								? `${n} months`
								: n === 1
									? "Show 1 month"
									: `Show ${n} months`}
						data-abt-tip-hint={waiting(n)
							? "They'll show once there's room"
							: n > budgetNav.displayMax
								? "Not enough room right now"
								: undefined}
						onclick={() => setCount(n)}>{n}</button
					>
				{/each}
			</div>
		{/if}
		{#if templatePlanState.triggerShown}
			<!-- The accent while the panel is free; plain while another panel holds its place, so it
			     doesn't read as the one showing. -->
			<button
				type="button"
				class="abt-btn"
				class:abt-tone-accent={!panelState.open}
				title="Open insights"
				aria-label="Open insights"
				onclick={() => openInsights()}
			>
				<Icon name="layout" size={14} />
				<span class="bmh__insights">Insights</span>
			</button>
		{/if}
	</div>
</div>

<style>
	/* Matches the side panel header beside it, border included. */
	.bmh {
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

	.bmh__icon {
		display: none;
	}
	/* Your pick, held back for room: dashed in the accent, unlike a count you never chose. */
	.abt-seg button.bmh__waiting {
		outline: 1px dashed var(--abt-accent-4);
		outline-offset: -2px;
	}

	.bmh:global(.bmh--squeeze-1) .abt-seg__label {
		display: none;
	}
	.bmh:global(.bmh--squeeze-4) .bmh__text {
		display: none;
	}
	.bmh:global(.bmh--squeeze-4) .bmh__icon {
		display: inline-flex;
	}
	.bmh:global(.bmh--squeeze-5) .bmh__insights {
		display: none;
	}

	/* Already on this month: plain text, so it doesn't read as a live button. */
	.bmh__today:disabled {
		opacity: 1;
		border-color: transparent;
		background: none;
		color: var(--abt-muted);
	}
</style>
