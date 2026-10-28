<script lang="ts">
	import Badge from "@lib/components/panel/Badge.svelte";
	import Callout from "@lib/components/panel/Callout.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { formatDayMonth, loadDatePrefs } from "@lib/utilities/date-format.svelte";
	import { onMount } from "svelte";
	import { templatePlanState } from "./state.svelte";
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

	function longMonth(monthKey: string): string {
		const [y, m] = monthKey.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
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
	{@const spentPctCapped = Math.min(100, spentPct)}
	{@const [yearNum, monthNum] = data.monthKey.split("-").map(Number)}
	{@const today = new Date()}
	{@const isCurrentMonth = today.getFullYear() === yearNum && today.getMonth() + 1 === monthNum}
	{@const daysInMonth = new Date(yearNum, monthNum, 0).getDate()}
	{@const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth}
	{@const monthElapsedPct = Math.min(100, Math.round((dayOfMonth / daysInMonth) * 100))}
	{@const spentAhead = data.totalBudgeted > 0 && spentPct > monthElapsedPct}
	{@const nextName = longMonth(data.nextMonthKey)}
	{@const setAsidePct =
		coverageTarget !== null && coverageTarget > 0
			? Math.round((data.nextMonthToBudget / coverageTarget) * 100)
			: 0}
	{@const nextOver = data.nextMonthToBudget - (coverageTarget ?? 0)}
	{@const maxOver =
		data.overspentCategories.length > 0 ? Math.abs(data.overspentCategories[0].leftover) : 1}

	<Section title="This Month">
		{#snippet badges()}
			{#if spentPct >= 100}
				<Badge tone="negative">over budget</Badge>
			{:else if spentAhead}
				<Badge tone="warning">spending fast</Badge>
			{:else if isCurrentMonth && data.totalBudgeted > 0}
				<Badge tone="positive">steady</Badge>
			{/if}
		{/snippet}
		<div class="abt-tab-overview-bdr-list">
			<div class="abt-tab-overview-bdr">
				<span class="abt-tab-overview-bdr-op">→</span>
				<span class="abt-tab-overview-bdr-label">Available funds</span>
				<RollingNumber
					value={data.availableFunds}
					resetKey={data.monthKey}
					class="abt-tab-overview-bdr-val abt-privacy-number"
				/>
			</div>
			<div class="abt-tab-overview-bdr">
				<span class="abt-tab-overview-bdr-op">−</span>
				<span class="abt-tab-overview-bdr-label">Assigned to categories</span>
				<RollingNumber
					value={data.totalBudgeted}
					resetKey={data.monthKey}
					class="abt-tab-overview-bdr-val abt-privacy-number"
				/>
			</div>
			{#if data.lastMonthOverspent !== 0}
				<div class="abt-tab-overview-bdr">
					<span class="abt-tab-overview-bdr-op" style="color:var(--color-errorText,#e57373)">−</span
					>
					<span class="abt-tab-overview-bdr-label">Last month overspent</span>
					<RollingNumber
						value={Math.abs(data.lastMonthOverspent)}
						resetKey={data.monthKey}
						class="abt-tab-overview-bdr-val abt-privacy-number"
						data-sign="neg"
					/>
				</div>
			{/if}
			<div class="abt-tab-overview-bdr abt-tab-overview-bdr--total">
				<span class="abt-tab-overview-bdr-op">=</span>
				<span class="abt-tab-overview-bdr-label" style="font-weight:600">Available</span>
				<RollingNumber
					value={data.toBudget}
					resetKey={data.monthKey}
					class="abt-tab-overview-bdr-val abt-tab-overview-bdr-avail abt-privacy-number"
					data-sign={data.toBudget < 0 ? "neg" : data.toBudget > 0 ? "pos" : null}
				/>
			</div>
		</div>

		{#if data.totalBudgeted > 0}
			<div class="abt-tab-overview-pace">
				<div class="abt-tab-overview-pace-head">
					<span>Spent</span>
					<span
						><span class="abt-privacy-number">{fmtMoney(data.totalSpent)}</span> of
						<span class="abt-privacy-number">{fmtMoney(data.totalBudgeted)}</span></span
					>
				</div>
				<!-- The tick marks today, so spending ahead of it shows at a glance. -->
				<div class="abt-tab-overview-pace-track" aria-hidden="true">
					<div
						class="abt-tab-overview-pace-fill"
						style:width="{spentPctCapped}%"
						data-status={spentPct >= 100 ? "over" : spentAhead ? "warn" : "ok"}
					></div>
					{#if isCurrentMonth}
						<div class="abt-tab-overview-pace-today" style:left="{monthElapsedPct}%"></div>
					{/if}
				</div>
				<div class="abt-tab-overview-pace-foot">
					<span class="abt-privacy-number">{spentPct}% spent</span>
					{#if isCurrentMonth}
						<span>Day {dayOfMonth} of {daysInMonth}</span>
					{/if}
				</div>
			</div>
		{/if}

		{#if data.bufferedSelected !== 0}
			<Callout tone="positive">
				✓ <span class="abt-privacy-number">{fmtMoney(data.bufferedSelected)}</span> saved for next month
			</Callout>
		{/if}
	</Section>

	<Section title="Ready for {nextName}">
		{#snippet badges()}
			{#if coverageTarget !== null && coverageTarget > 0}
				{#if nextOver >= 0}
					<Badge tone="positive">covered</Badge>
				{:else}
					<Badge tone="warning">short</Badge>
				{/if}
			{/if}
		{/snippet}
		{#if coverageTarget === null}
			<div class="abt-tab-overview-empty-row">
				Couldn't preview {nextName}'s goal templates. Refresh to try again.
			</div>
		{:else if coverageTarget <= 0}
			<div class="abt-tab-overview-empty-row">
				{useGoalTemplates
					? `${nextName}'s goals are already funded.`
					: `Not enough spending history to compare ${nextName} against.`}
			</div>
		{:else}
			<Row name="Set aside" value={fmtMoney(data.nextMonthToBudget)}>
				<div class="abt-tab-overview-mini-bar-wrap">
					<div
						class="abt-tab-overview-mini-bar"
						style="width:{Math.max(0, Math.min(100, setAsidePct))}%"
						data-status={nextOver >= 0 ? "ok" : setAsidePct >= 70 ? "warn" : "over"}
					></div>
				</div>
			</Row>
			<Row
				name={useGoalTemplates ? "Goals left to fund" : "Recent monthly spending"}
				value={fmtMoney(coverageTarget)}
				tone="muted"
			/>
			{#if nextOver >= 0}
				<Row name="Spare" value={fmtMoney(nextOver)} tone="positive" strong />
			{:else}
				<Row name="Still to set aside" value={fmtMoney(-nextOver)} tone="negative" strong />
			{/if}
		{/if}
	</Section>

	<!-- ── Spending Trend ─────────────────────────────────────────── -->
	{#if data.trend.length > 0}
		<Section title="Spending Trend">
			<TrendChart
				trend={data.trend}
				valueKey="spent"
				currentMonthKey={data.monthKey}
				barColor="var(--abt-accent)"
				barColorDim="var(--abt-accent-3)"
				higherIsBad={true}
			/>
		</Section>

		<Section title="Budgeting Trend">
			<TrendChart
				trend={data.trend}
				valueKey="budgeted"
				currentMonthKey={data.monthKey}
				barColor="var(--abt-panel-accent-secondary)"
				barColorDim="color-mix(in srgb, var(--abt-panel-accent-secondary) 35%, transparent)"
			/>
		</Section>
	{/if}

	<!-- ── Overspent ─────────────────────────────────────────────── -->
	{#if data.overspentCategories.length > 0}
		<Section title="Overspent" tone="error" count={data.overspentCategories.length}>
			{#each data.overspentCategories as cat (cat.id)}
				{@const overPct = Math.round((Math.abs(cat.leftover) / maxOver) * 100)}
				<Row name={cat.name} meta={cat.groupName} value={fmtMoney(cat.leftover)} tone="negative">
					<div class="abt-tab-overview-mini-bar-wrap">
						<div
							class="abt-tab-overview-mini-bar"
							style="width:{overPct}%"
							data-status="over"
						></div>
					</div>
				</Row>
			{/each}
		</Section>
	{/if}

	<!-- ── Goals ─────────────────────────────────────────────────── -->
	{#if data.totalGoalCount > 0}
		<Section title="Goals" count={`${data.fullyFundedGoalCount}/${data.totalGoalCount}`}>
			{#snippet badges()}
				{#if data.underfundedGoals.length > 0}
					<Badge tone="warning">{data.underfundedGoals.length} to fund</Badge>
				{:else}
					<Badge tone="positive">all funded</Badge>
				{/if}
			{/snippet}
			{#if data.underfundedGoals.length === 0}
				<Callout tone="positive">All goals met ✓</Callout>
			{:else}
				{#each data.underfundedGoals as cat (cat.id)}
					{@const funded = Math.max(0, cat.leftover)}
					{@const goalPct = cat.goal ? Math.min(100, Math.round((funded / cat.goal) * 100)) : 0}
					{@const needed = (cat.goal ?? 0) - cat.leftover}
					<Row name={cat.name} value={`needs ${fmtMoney(needed)}`} tone="negative">
						<div class="abt-tab-overview-mini-bar-wrap">
							<div
								class="abt-tab-overview-mini-bar"
								style="width:{goalPct}%"
								data-status="goal"
							></div>
						</div>
					</Row>
				{/each}
			{/if}
		</Section>
	{/if}

	<!-- ── Scheduled Transactions ─────────────────────────────────── -->
	<Section
		title="Scheduled Transactions"
		count={data.upcomingSchedules.length > 0 ? data.upcomingSchedules.length : undefined}
	>
		{#if data.upcomingSchedules.length > 0}
			{#each data.upcomingSchedules as s (s.id)}
				<Row name={s.name}>
					{#snippet leading()}
						<span class="abt-tab-overview-sched-dot" aria-hidden="true"></span>
						<span class="abt-tab-overview-sched-date">{formatDayMonth(s.nextDate)}</span>
					{/snippet}
				</Row>
			{/each}
		{:else}
			<div class="abt-tab-overview-empty-row">No scheduled transactions in the next 30 days</div>
		{/if}
	</Section>
{/if}
