<script lang="ts">
	import Badge from "@lib/components/panel/Badge.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { monthOf } from "@lib/utilities/months";
	import { formatDayMonth, loadDatePrefs } from "@lib/utilities/date-format.svelte";
	import { onMount } from "svelte";
	import { templatePlanState } from "./state.svelte";
	import NextMonth from "./NextMonth.svelte";
	import OverviewToolbar from "./OverviewToolbar.svelte";
	import TabSkeleton from "./TabSkeleton.svelte";
	import TrendChart from "./TrendChart.svelte";

	const data = $derived(templatePlanState.overviewData);
	const useGoalTemplates = $derived(templatePlanState.coverageMethod === "goal-templates");
	const coverageTarget = $derived(
		data ? (useGoalTemplates ? data.nextMonthGoalTotal : data.recentAvgSpending) : null,
	);
	const loading = $derived(templatePlanState.overviewLoading);

	function triggerRefresh() {
		if (!loading) {
			templatePlanState.onTabChange?.("overview");
		}
	}

	onMount(() => {
		loadDatePrefs();
		if (!templatePlanState.overviewData && !templatePlanState.overviewLoading) {
			templatePlanState.onTabChange?.("overview");
		}
	});
</script>

<OverviewToolbar />

{#if !data && loading}
	<TabSkeleton tab="overview" />
{:else if !data}
	<div class="abt-tab-empty">
		<button type="button" class="abt-tab-overview-load-btn" onclick={triggerRefresh}
			>Load overview</button
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
	{@const assignedMonths = data.trend.filter((t) => t.budgeted > 0)}
	{@const typicalMonth =
		assignedMonths.reduce((sum, t) => sum + t.budgeted, 0) / (assignedMonths.length || 1)}
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

	<Section title="This Month">
		{#snippet badges()}
			{#if data.totalBudgeted > 0 && !isFutureMonth}
				<Badge
					tone={spentPct >= 100
						? "negative"
						: isCurrentMonth && spentAhead
							? "warning"
							: "positive"}>{spentPct}% spent</Badge
				>
			{/if}
		{/snippet}
		{@const spentShare = Math.min(data.totalSpent, data.totalBudgeted)}
		{@const parts = [
			{ key: "overspent", label: "Overspent last month", value: Math.abs(data.lastMonthOverspent) },
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
	</Section>

	{@const pending = data.hasTemplates ? Math.max(0, data.templateRemaining ?? 0) : 0}
	{@const nextNeed =
		coverageTarget === null
			? null
			: useGoalTemplates
				? data.nextMonthBudgeted + coverageTarget || typicalMonth
				: coverageTarget}
	<NextMonth
		monthKey={data.nextMonthKey}
		held={data.bufferedSelected + Math.max(0, data.toBudget - pending)}
		need={nextNeed}
		needLabel={!useGoalTemplates
			? "your usual spending"
			: data.nextMonthBudgeted + (coverageTarget ?? 0) > 0
				? "for its goals"
				: "for a typical month"}
		projected={unplannedBetween}
		emptyText={coverageTarget === null
			? "Couldn't preview next month's goal templates. Refresh to try again."
			: "Not enough spending history to compare next month against."}
	/>

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

	{#if data.trend.length > 0}
		<Section title="Spent vs Budgeted">
			<div class="abt-tab-overview-legend" aria-hidden="true">
				<span><i style="background:var(--abt-ink-5)"></i>Budgeted</span>
				<span><i style="background:var(--abt-accent)"></i>Spent</span>
			</div>
			<TrendChart
				trend={data.trend}
				valueKey="spent"
				currentMonthKey={data.monthKey}
				barColor="var(--abt-accent)"
				barColorDim="var(--abt-ink-5)"
				withBudget
			/>
			<p class="abt-tab-overview-note">
				{overMonths > 0
					? `Over budget in ${overMonths} of the last ${data.trend.length} months.`
					: `Total spending stayed under budget every month.`}
			</p>
		</Section>
	{/if}

	<Section
		title="Coming Up"
		count={data.upcomingSchedules.length > 0 ? data.upcomingSchedules.length : undefined}
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
{/if}
