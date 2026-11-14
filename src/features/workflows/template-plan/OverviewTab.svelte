<script lang="ts">
	import { scrollLaidOutIntoView } from "@lib/dom/dom";
	import Badge from "@lib/components/panel/Badge.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/format/currency";
	import { addMonths, monthOf, parseMonth } from "@lib/format/months";
	import { formatDayMonth, loadDatePrefs } from "@lib/format/date-format.svelte";
	import CategoryIcon from "@lib/components/CategoryIcon.svelte";
	import { onMount } from "svelte";
	import { cardsInRow } from "@features/workflows/budget-summary-row/state.svelte";
	import { type LongGoalRow, templatePlanState } from "./state.svelte";
	import { flip } from "svelte/animate";
	import { fade, slide } from "svelte/transition";
	import { type CardId, TEMPLATES_BAR, cardLabel } from "./cards";
	import {
		firstMoveRows,
		groupMoves,
		heldForNextMonth,
		nextMonthGoalNeed,
		usesGoalTemplates,
	} from "./overview";
	import NextMonth from "./NextMonth.svelte";
	import OverviewToolbar from "./OverviewToolbar.svelte";
	import TabSkeleton from "./TabSkeleton.svelte";
	import TrendChart from "./TrendChart.svelte";

	const data = $derived(templatePlanState.overviewData);
	const useGoalTemplates = $derived(!!data && usesGoalTemplates(data));
	const coverageTarget = $derived(
		data ? (useGoalTemplates ? data.nextMonthGoalTotal : data.recentAvgSpending) : null,
	);
	const loading = $derived(templatePlanState.overviewLoading);
	const shownCards = $derived(
		templatePlanState.cards.order.filter((id) => !templatePlanState.cards.hidden.includes(id)),
	);
	/** Cards the summary row shows, which this tab leaves out or trims so nothing shows twice. */
	const inRow = $derived(cardsInRow());
	const motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
	// The Reassigned card lists the latest few; the rest open on request.
	const MOVES_SHOWN = 5;
	let allMoves = $state(false);

	// While the card menu points at a card, it's outlined.
	const spot = (id: string) => ({
		"data-spot": templatePlanState.highlightCard === id ? "" : undefined,
	});

	// Also as the order changes, so a card being moved doesn't scroll out from under the menu.
	$effect(() => {
		const lit = templatePlanState.highlightCard;
		void templatePlanState.cards.order;
		if (lit) {
			// Right away, to where it lands: the slide's transform is left out.
			const slot = document.querySelector<HTMLElement>(`.abt-card-slot[data-card="${lit}"]`);
			if (slot) {
				scrollLaidOutIntoView(slot, motion ? "smooth" : "auto");
			}
		}
	});
	// Close to the whole budget reads as neither good nor bad, so it isn't green.
	const NEAR_LIMIT = 90;

	function triggerRefresh() {
		if (!loading) {
			templatePlanState.onTabChange?.("overview");
		}
	}

	/** Actual's notes write the day as "November 08"; anything else is shown as written. */
	const goalMonth = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });

	/** The month the goal is reached at this month's pace. */
	function goalOutlook(g: LongGoalRow): string | null {
		if (g.balance >= g.goal) {
			return "Reached";
		}
		if (!data || g.monthly <= 0) {
			return "Nothing added this month";
		}
		const { year, month } = parseMonth(
			addMonths(data.monthKey, Math.ceil((g.goal - g.balance) / g.monthly)),
		);
		return `by ${goalMonth.format(new Date(year, month))}`;
	}

	const shortDay = (day: string) => day.replace(/^([A-Za-z]{3})[A-Za-z]* 0?(\d{1,2})$/, "$1 $2");

	onMount(() => {
		loadDatePrefs();
		if (!templatePlanState.overviewData && !templatePlanState.overviewLoading) {
			templatePlanState.onTabChange?.("overview");
		}
	});
</script>

{#if !templatePlanState.cards.hidden.includes(TEMPLATES_BAR)}
	<div
		class="abt-card-slot"
		data-card={TEMPLATES_BAR}
		{...spot(TEMPLATES_BAR)}
		transition:slide={{ duration: motion }}
	>
		<OverviewToolbar />
	</div>
{/if}

{#if !data && loading}
	<TabSkeleton tab="overview" />
{:else if !data}
	<div class="abt-tab-empty">
		<button type="button" class="abt-btn abt-btn--sm" onclick={triggerRefresh}>Load overview</button
		>
	</div>
{:else}
	{@const spentPct =
		data.totalBudgeted > 0 ? Math.round((data.totalSpent / data.totalBudgeted) * 100) : 0}
	{@const [yearNum, monthNum] = data.monthKey.split("-").map(Number)}
	{@const today = new Date()}
	{@const isCurrentMonth = today.getFullYear() === yearNum && today.getMonth() + 1 === monthNum}
	{@const daysInMonth = new Date(yearNum, monthNum, 0).getDate()}
	{@const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth}
	{@const elapsed = dayOfMonth / daysInMonth}
	{@const spentAhead = data.totalBudgeted > 0 && spentPct > Math.round(elapsed * 100)}
	{@const isFutureMonth =
		yearNum > today.getFullYear() ||
		(yearNum === today.getFullYear() && monthNum > today.getMonth() + 1)}
	{@const thisMonth = monthOf(today)}
	{@const unplannedBetween =
		isFutureMonth &&
		(data.trend[0].monthKey > thisMonth ||
			data.trend.some((t) => t.monthKey >= thisMonth && t.budgeted <= 0))}
	{@const overMonths = data.trend.filter((t) => t.budgeted > 0 && t.spent > t.budgeted).length}

	{#snippet toBudgetRow()}
		<Row
			name="Available to budget"
			value={fmtMoney(data.toBudget)}
			tone={data.toBudget < 0 ? "negative" : data.toBudget > 0 ? "positive" : undefined}
			strong
		>
			{#snippet leading()}
				<span class="abt-tab-overview-swatch" data-part="free"></span>
			{/snippet}
		</Row>
	{/snippet}

	{#if data.overspentCategories.length > 0}
		<Section title="Overspent" tone="error" count={data.overspentCategories.length}>
			{#each data.overspentCategories as cat (cat.id)}
				<Row name={cat.name} meta={cat.groupName} value={fmtMoney(cat.leftover)} tone="negative" />
			{/each}
		</Section>
	{/if}

	{#snippet thisMonthCard()}
		<Section title="This Month">
			{#snippet badges()}
				{#if data.totalBudgeted > 0 && !isFutureMonth && !inRow.includes("spent")}
					<Badge
						tone={spentPct >= 100
							? "negative"
							: isCurrentMonth && spentAhead
								? "warning"
								: spentPct >= NEAR_LIMIT
									? "neutral"
									: "positive"}>{spentPct}% spent</Badge
					>
				{/if}
			{/snippet}
			{#if data.budgetType === "tracking"}
				{#if !inRow.includes("income")}
					<Row name="Income received" value={fmtMoney(data.income.received)} />
					<Row name="Income budgeted" value={fmtMoney(data.incomeBudgeted)} tone="muted" />
				{/if}
				<Row name="Spent" value={fmtMoney(data.totalSpent)} />
				<Row name="Spending budget" value={fmtMoney(data.spentBudgeted)} tone="muted" />
				<div class="abt-tab-overview-total">
					<Row
						name="Saved so far"
						value={fmtMoney(data.saved)}
						tone={data.saved < 0 ? "negative" : "positive"}
						strong
					/>
					<Row name="Projected savings" value={fmtMoney(data.projected)} tone="muted" />
				</div>
			{:else}
				{@const spentShare = Math.min(data.totalSpent, data.totalBudgeted)}
				{@const parts = [
					{
						key: "overspent",
						label: "Overspent last month",
						value: Math.abs(data.lastMonthOverspent),
					},
					{ key: "spent", label: "Spent", value: spentShare },
					{ key: "left", label: "Assigned, not spent yet", value: data.totalBudgeted - spentShare },
					{ key: "held", label: "Held for next month", value: data.bufferedSelected },
					{ key: "free", label: "Not assigned yet", value: Math.max(0, data.toBudget) },
				].filter((p) => p.value > 0)}
				{@const whole = parts.reduce((sum, p) => sum + p.value, 0)}
				{@const leadUnassigned = data.toBudget !== 0}
				{#if leadUnassigned}
					{@render toBudgetRow()}
				{:else}
					<Row name="Available funds" value={fmtMoney(data.availableFunds)} strong />
				{/if}
				{@const onPace = Math.round(data.totalBudgeted * elapsed)}
				{@const showPace = isCurrentMonth && data.totalBudgeted > 0 && whole > 0}
				{#if whole > 0}
					<div class="abt-tab-overview-split-wrap">
						<div class="abt-tab-overview-split" aria-hidden="true">
							{#each parts as p (p.key)}
								<span data-part={p.key} style:flex-grow={p.value / whole}></span>
							{/each}
						</div>
						{#if showPace}
							<span
								class="abt-tab-overview-pace-tick"
								aria-hidden="true"
								style:left="{((Math.abs(data.lastMonthOverspent) + onPace) / whole) * 100}%"
							></span>
						{/if}
					</div>
				{/if}
				{#if showPace}
					<p class="abt-tab-overview-pace-note" data-ahead={data.totalSpent > onPace}>
						{#if data.totalSpent > onPace}
							Ahead of pace by <span class="abt-privacy-number"
								>{fmtMoney(data.totalSpent - onPace)}</span
							>
						{:else}
							On pace, <span class="abt-privacy-number">{fmtMoney(onPace - data.totalSpent)}</span> under
						{/if}
						<span class="abt-tab-overview-pace-day">· day {dayOfMonth} of {daysInMonth}</span>
					</p>
				{/if}
				{#each parts as p (p.key)}
					{#if p.key !== "free"}
						<Row name={p.label} value={fmtMoney(p.value)} tone="muted">
							{#snippet leading()}
								<span class="abt-tab-overview-swatch" data-part={p.key}></span>
							{/snippet}
						</Row>
					{/if}
				{/each}
				<div class="abt-tab-overview-total">
					{#if leadUnassigned}
						<Row name="Available funds" value={fmtMoney(data.availableFunds)} strong />
					{:else}
						{@render toBudgetRow()}
					{/if}
				</div>
			{/if}
		</Section>
	{/snippet}

	{#snippet nextMonthCard()}
		{@const nextNeed = useGoalTemplates ? nextMonthGoalNeed(data) : coverageTarget}
		<NextMonth
			monthKey={data.nextMonthKey}
			held={heldForNextMonth(data)}
			need={nextNeed}
			projected={unplannedBetween}
			loading={useGoalTemplates && data.aheadTemplateNeeds === null}
			later={useGoalTemplates
				? (data.aheadTemplateNeeds ?? [])
				: Array.from({ length: 11 }, () => coverageTarget ?? 0)}
			emptyText={coverageTarget === null
				? "Couldn't preview next month's goal templates. Refresh to try again."
				: "Not enough spending history to compare next month against."}
		/>
	{/snippet}

	{#snippet goalsCard()}
		{#if data.underfundedGoals.length > 0}
			<Section title="Goals to Fund" count={`${data.fullyFundedGoalCount}/${data.totalGoalCount}`}>
				{#each data.underfundedGoals as cat (cat.id)}
					{@const goal = cat.goal ?? 0}
					<Row name={cat.name} value={fmtMoney(goal - cat.leftover)}>
						<div class="abt-tab-overview-mini-bar-wrap">
							<div
								class="abt-tab-overview-mini-bar"
								style="width:{goal > 0
									? Math.min(100, Math.max(0, (cat.leftover / goal) * 100))
									: 0}%"
								data-status="goal"
							></div>
						</div>
					</Row>
				{/each}
			</Section>
		{/if}
	{/snippet}

	{#snippet longGoalsCard()}
		{@const reached = data.longGoals.filter((g) => g.balance >= g.goal).length}
		<Section title="Long-term Goals" count={`${reached}/${data.longGoals.length}`}>
			{#each data.longGoals as g (g.id)}
				<Row
					name={g.name}
					meta={goalOutlook(g)}
					value={`${fmtMoney(Math.max(0, g.balance))} / ${fmtMoney(g.goal)}`}
				>
					<div class="abt-tab-overview-mini-bar-wrap">
						<div
							class="abt-tab-overview-mini-bar"
							style="width:{Math.min(100, Math.max(0, (g.balance / g.goal) * 100))}%"
							data-status={g.balance >= g.goal ? "ok" : "goal"}
						></div>
					</div>
				</Row>
			{/each}
		</Section>
	{/snippet}

	{#snippet trendCard()}
		{#if data.trend.length > 0}
			<Section title="Over / Under Budget">
				<div class="abt-tab-overview-legend" aria-hidden="true">
					<span><i data-tone="under"></i>Under</span>
					<span><i style="background:var(--color-errorText)"></i>Over</span>
				</div>
				<TrendChart trend={data.trend} currentMonthKey={data.monthKey} />
				<p class="abt-tab-overview-note">
					{overMonths > 0
						? `Over budget in ${overMonths} of the last ${data.trend.length} months.`
						: `Total spending stayed under budget every month.`}
				</p>
			</Section>
		{/if}
	{/snippet}

	{#snippet incomeCard()}
		{@const income = data.income}
		{@const share = income.usual ? Math.round((income.received / income.usual) * 100) : null}
		<Section title="Income">
			{#snippet badges()}
				{#if share !== null && income.received > 0 && !inRow.includes("income")}
					<Badge tone={share >= 100 ? "positive" : "neutral"}>{share}% of usual</Badge>
				{/if}
			{/snippet}
			{#if inRow.includes("income")}
				<!-- The row's Income card has the total and how it compares; this keeps where it came from. -->
				{#each income.categories as cat (cat.id)}
					<Row name={cat.name} value={fmtMoney(cat.amount)} tone="muted">
						{#snippet leading()}
							<CategoryIcon id={cat.id} />
						{/snippet}
					</Row>
				{:else}
					<div class="abt-tab-overview-empty-row">Nothing received yet</div>
				{/each}
			{:else}
				<Row name="Received" value={fmtMoney(income.received)} strong />
				{#if income.usual}
					<div class="abt-tab-overview-mini-bar-wrap">
						<div
							class="abt-tab-overview-mini-bar"
							style:width="{Math.min(100, (income.received / income.usual) * 100)}%"
							data-status="goal"
						></div>
					</div>
					{@const average =
						income.usualMonths === 1 ? "last month" : `your ${income.usualMonths}-month average`}
					<p class="abt-tab-overview-note">
						<span class="abt-privacy-number"
							>{fmtMoney(Math.abs(income.received - income.usual))}</span
						>
						{income.received >= income.usual ? "above" : "below"}
						{average}
					</p>
				{/if}
				{#if income.categories.length > 1}
					<div class="abt-tab-overview-split-rows">
						{#each income.categories as cat (cat.id)}
							<Row name={cat.name} value={fmtMoney(cat.amount)} tone="muted">
								{#snippet leading()}
									<CategoryIcon id={cat.id} />
								{/snippet}
							</Row>
						{/each}
					</div>
				{/if}
			{/if}
		</Section>
	{/snippet}

	{#snippet movesCard()}
		{@const moves = data.moves}
		{@const days = groupMoves(moves)}
		{@const rowCount = days.reduce((n, d) => n + d.rows.length, 0)}
		<Section title="Reassigned" count={moves.length || undefined}>
			{#if moves.length}
				{#each allMoves ? days : firstMoveRows(days, MOVES_SHOWN) as group (group.key)}
					<div class="abt-tab-overview-move-group">
						<div class="abt-tab-overview-day">
							{shortDay(group.day)}{#if group.from}&nbsp;· from {group.from}{/if}
						</div>
						{#each group.rows as row (row.key)}
							<Row
								name={group.from ? row.to : `${row.from} → ${row.to}`}
								count={row.count}
								value={fmtMoney(row.amount)}
							/>
						{/each}
					</div>
				{/each}
				{#if rowCount > MOVES_SHOWN}
					<button
						type="button"
						class="abt-tab-overview-more"
						onclick={() => (allMoves = !allMoves)}
					>
						{allMoves ? "Show fewer" : `Show all ${rowCount}`}
					</button>
				{/if}
			{:else}
				<div class="abt-tab-overview-empty-row">
					No money moved with Transfer or Cover this month
				</div>
			{/if}
		</Section>
	{/snippet}

	{#snippet comingUpCard()}
		<Section
			title="Coming Up"
			count={data.upcomingSchedules.length > 0
				? `From today · ${data.upcomingSchedules.length}`
				: undefined}
		>
			{#if data.upcomingSchedules.length > 0}
				{#each data.upcomingSchedules as s (s.id)}
					<Row
						name={s.name}
						value={s.amount === null ? undefined : fmtMoney(s.amount)}
						tone={s.amount !== null && s.amount > 0 ? "positive" : undefined}
					>
						{#snippet leading()}
							<span class="abt-tab-overview-sched-date">{formatDayMonth(s.nextDate)}</span>
						{/snippet}
					</Row>
				{/each}
			{:else}
				<div class="abt-tab-overview-empty-row">Nothing scheduled in the next 30 days</div>
			{/if}
		</Section>
	{/snippet}

	{@const hasContent = (id: CardId) =>
		(id !== "next-month" || !inRow.includes("runway")) &&
		(id !== "goals" || data.underfundedGoals.length > 0) &&
		(id !== "long-goals" || data.longGoals.length > 0) &&
		(id !== "trend" || data.trend.length > 0)}
	<!-- While the card menu is open, cards with nothing to show stand in, so moving them shows. -->
	{@const availableCards =
		data.budgetType === "tracking" ? shownCards.filter((id) => id !== "next-month") : shownCards}
	{@const present = templatePlanState.customizingCards
		? availableCards
		: availableCards.filter(hasContent)}

	{#snippet standIn(id: CardId)}
		<Section title={cardLabel(id)} collapsible={false}>
			<div class="abt-tab-overview-empty-row">
				{id === "next-month"
					? "Months ahead is in the summary row above the budget"
					: id === "trend"
						? "Shows once there's a month of history"
						: id === "long-goals"
							? "Shows when a category has a long-term goal"
							: data.totalGoalCount > 0
								? "Every goal is funded, so it's hidden for now"
								: "Shows when a category has a goal to fund"}
			</div>
		</Section>
	{/snippet}

	{#each present as id (id)}
		<div
			class="abt-card-slot"
			data-card={id}
			{...spot(id)}
			animate:flip={{ duration: motion }}
			in:fade={{ duration: motion }}
			out:fade={{ duration: motion * 0.6 }}
		>
			{#if !hasContent(id)}
				{@render standIn(id)}
			{:else if id === "this-month"}
				{@render thisMonthCard()}
			{:else if id === "next-month"}
				{@render nextMonthCard()}
			{:else if id === "goals"}
				{@render goalsCard()}
			{:else if id === "long-goals"}
				{@render longGoalsCard()}
			{:else if id === "trend"}
				{@render trendCard()}
			{:else if id === "coming-up"}
				{@render comingUpCard()}
			{:else if id === "income"}
				{@render incomeCard()}
			{:else if id === "moves"}
				{@render movesCard()}
			{/if}
		</div>
	{/each}
{/if}

<style>
	/* Each card's own box, so cards can move and fold; spaced as the sections were. */
	:global(.section) + .abt-card-slot,
	.abt-card-slot:not([data-card="templates"]) + .abt-card-slot {
		margin-top: 10px;
	}

	.abt-card-slot:not(:last-child) > :global(.section) {
		padding-bottom: 0;
	}

	.abt-card-slot > :global(.section > .card),
	.abt-card-slot > :global(.abt-tab-overview-toolbar) {
		transition: border-color 0.2s ease;
	}

	.abt-card-slot[data-spot] > :global(.section > .card),
	.abt-card-slot[data-spot] > :global(.abt-tab-overview-toolbar) {
		border-color: var(--abt-accent-4);
	}

	@media (prefers-reduced-motion: reduce) {
		.abt-tab-overview-mini-bar,
		.abt-tab-overview-split span {
			transition: none;
		}
	}

	/* ── This Month ─────────────────────────────────────────────── */
	/* Where the month's funds went: one bar, its rows below as the key. */
	.abt-tab-overview-split-wrap {
		position: relative;
		margin: 6px 0 8px;
	}

	/* Where spending would be today if it were spread evenly through the month. */
	.abt-tab-overview-pace-tick {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		margin-left: -1px;
		border-radius: 1px;
		background: var(--abt-ink);
	}

	.abt-tab-overview-pace-note {
		margin: 0 0 6px;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		font-variant-numeric: tabular-nums;
	}
	.abt-tab-overview-pace-note[data-ahead="true"] {
		color: var(--color-warningText);
	}
	.abt-tab-overview-pace-day {
		color: var(--abt-muted);
	}

	.abt-tab-overview-split {
		display: flex;
		gap: var(--abt-space-1);
		height: 10px;
		border-radius: var(--abt-radius-pill);
		overflow: hidden;
	}
	.abt-tab-overview-split span {
		min-width: 3px;
		flex-basis: 0;
		transition: flex-grow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.abt-tab-overview-swatch {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
		border-radius: 2px;
	}

	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="overspent"] {
		background: var(--color-errorText);
	}
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="spent"] {
		background: var(--abt-accent);
	}
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="left"] {
		background: var(--abt-accent-3);
	}
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="held"] {
		background: var(--color-budgetNumberPositive);
	}
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="free"] {
		background: var(--color-warningText);
	}

	.abt-tab-overview-total {
		margin-top: var(--abt-space-2);
		padding-top: var(--abt-space-2);
		border-top: 1px solid var(--abt-panel-border);
	}

	/* The Reassigned card's date headings, one per day. */
	.abt-tab-overview-day {
		margin: var(--abt-space-3) 0 var(--abt-space-1);
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}

	.abt-tab-overview-day:first-child {
		margin-top: 0;
	}

	/* Each day, or a day's moves out of one category, set apart by a rule. */
	.abt-tab-overview-move-group + .abt-tab-overview-move-group {
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-ink-2);
	}

	/* The income categories under the total, set apart like the moves' days. */
	.abt-tab-overview-split-rows {
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-ink-2);
	}

	/* The Reassigned card's "Show all": a quiet link under the list. */
	.abt-tab-overview-more {
		display: block;
		margin: 6px 0 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--abt-text-xs);
		color: var(--abt-accent);
		cursor: pointer;
	}

	.abt-tab-overview-more:hover {
		text-decoration: underline;
	}

	.abt-tab-overview-note {
		margin: 6px 0 0;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		line-height: 1.45;
	}

	.abt-tab-overview-legend {
		display: flex;
		gap: var(--abt-space-4);
		margin-bottom: var(--abt-space-3);
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}
	.abt-tab-overview-legend span {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
	}
	.abt-tab-overview-legend i {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.abt-tab-overview-legend i[data-tone="under"] {
		background: color-mix(
			in srgb,
			var(--color-budgetNumberPositive) 75%,
			transparent
		); /* raw: matches the trend chart */
	}

	/* Mini progress bars */
	.abt-tab-overview-mini-bar-wrap {
		height: 4px;
		border-radius: 2px;
		background: var(--abt-panel-track);
		overflow: hidden;
	}
	.abt-tab-overview-mini-bar {
		height: 100%;
		border-radius: 2px;
		min-width: 2px;
		transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.abt-tab-overview-mini-bar[data-status="ok"] {
		background: var(--abt-accent);
	}
	.abt-tab-overview-mini-bar[data-status="warn"] {
		background: var(--color-warningText);
	}
	.abt-tab-overview-mini-bar[data-status="over"] {
		background: var(--color-errorText);
	}
	.abt-tab-overview-mini-bar[data-status="goal"] {
		background: linear-gradient(
			90deg,
			var(--abt-accent) 0%,
			var(--abt-panel-accent-secondary) 100%
		);
	}

	.abt-tab-overview-sched-date {
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
		flex-shrink: 0;
		width: 44px;
		font-size: var(--abt-text-sm);
	}
</style>
