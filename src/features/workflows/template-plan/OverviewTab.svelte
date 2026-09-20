<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";
	import { onMount } from "svelte";
	import { templatePlanState } from "./state.svelte";
	import TrendChart from "./TrendChart.svelte";

	const data = $derived(templatePlanState.overviewData);
	const useGoalTemplates = $derived(templatePlanState.coverageMethod === "goal-templates");
	const coverageTarget = $derived(
		data ? (useGoalTemplates ? data.nextMonthGoalTotal : data.recentAvgSpending) : null,
	);
	const loading = $derived(templatePlanState.overviewLoading);

	let closed = $state<Record<string, boolean>>({});
	const open = (s: string) => !closed[s];
	const toggle = (s: string) => {
		closed[s] = !closed[s];
	};

	function triggerRefresh() {
		if (!loading) templatePlanState.onTabChange?.("overview");
	}

	function applyTemplates() {
		templatePlanState.applyTemplates?.();
	}

	function formatDate(isoDate: string): string {
		const parts = isoDate.split("-").map(Number);
		const d = new Date(parts[0], parts[1] - 1, parts[2]);
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function longMonth(monthKey: string): string {
		const [y, m] = monthKey.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
	}

	onMount(() => {
		if (!templatePlanState.overviewData && !templatePlanState.overviewLoading) {
			templatePlanState.onTabChange?.("overview");
		}
	});

	const RING_R = 22;
	const RING_CIRC = 2 * Math.PI * RING_R;
</script>

{#if !data && loading}
	<div class="abt-tab-loading">
		<span class="abt-tab-spinner"></span>
		Loading overview…
	</div>
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
	{@const ringColor =
		spentPct >= 100
			? "var(--color-errorText, #e57373)"
			: spentPct >= 85
				? "var(--color-warningText, #e0c590)"
				: "#7c3aed"}
	{@const dashFill = (RING_CIRC * spentPctCapped) / 100}
	{@const [yearNum, monthNum] = data.monthKey.split("-").map(Number)}
	{@const today = new Date()}
	{@const isCurrentMonth = today.getFullYear() === yearNum && today.getMonth() + 1 === monthNum}
	{@const daysInMonth = new Date(yearNum, monthNum, 0).getDate()}
	{@const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth}
	{@const monthElapsedPct = Math.min(100, Math.round((dayOfMonth / daysInMonth) * 100))}
	{@const daysLeft = isCurrentMonth ? daysInMonth - dayOfMonth : 0}
	{@const spentAhead = data.totalBudgeted > 0 && spentPct > monthElapsedPct}
	{@const nextCoveragePct =
		coverageTarget !== null && coverageTarget > 0
			? Math.round((data.nextMonthToBudget / coverageTarget) * 100)
			: 0}
	{@const nextOver = data.nextMonthToBudget - (coverageTarget ?? 0)}
	{@const maxOver =
		data.overspentCategories.length > 0 ? Math.abs(data.overspentCategories[0].leftover) : 1}

	<!-- Quick Actions -->
	<div class="abt-tab-overview-actions">
		<button type="button" class="abt-tab-overview-apply-btn" onclick={applyTemplates}>
			✦ Apply Templates
		</button>
		<button
			type="button"
			class="abt-tab-overview-refresh-btn"
			onclick={triggerRefresh}
			disabled={loading}
			title="Refresh overview"
			aria-label="Refresh overview"
		>
			{#if loading}
				<span class="abt-tab-spinner" style="width:9px;height:9px;border-width:1.5px;margin:0"
				></span>
			{:else}
				↻
			{/if}
		</button>
	</div>

	<!-- ── Month Breakdown ─────────────────────────────────────────── -->
	<div class="abt-tab-overview-cs">
		<button class="abt-tab-overview-sh" onclick={() => toggle("breakdown")}>
			<span class="abt-tab-overview-st">Month Breakdown</span>
			<svg
				class="abt-tab-overview-chevron"
				data-open={open("breakdown")}
				width="12"
				height="12"
				viewBox="0 0 12 12"
				aria-hidden="true"
			>
				<polyline
					points="2,4 6,8 10,4"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
		{#if open("breakdown")}
			<div class="abt-tab-overview-card">
				<div class="abt-tab-overview-card-hero">
					<div class="abt-tab-overview-ring-wrap" aria-hidden="true">
						<svg width="48" height="48" viewBox="0 0 48 48" style="overflow:visible">
							<circle
								cx="24"
								cy="24"
								r={RING_R}
								fill="none"
								stroke="rgba(255,255,255,0.08)"
								stroke-width="6"
							/>
							{#if data.totalBudgeted > 0}
								<circle
									cx="24"
									cy="24"
									r={RING_R}
									fill="none"
									stroke={ringColor}
									stroke-width="6"
									stroke-linecap="round"
									stroke-dasharray={RING_CIRC}
									stroke-dashoffset={RING_CIRC - dashFill}
									transform="rotate(-90 24 24)"
								/>
							{/if}
						</svg>
						<div class="abt-tab-overview-ring-label" style="font-size:9px">
							{data.totalBudgeted > 0 ? `${spentPctCapped}%` : "—"}
						</div>
					</div>
					<div class="abt-tab-overview-card-hero-info">
						<span class="abt-tab-overview-hero-label">Available to budget</span>
						<span
							class="abt-tab-overview-hero-amount abt-privacy-number"
							data-sign={data.toBudget < 0 ? "neg" : data.toBudget > 0 ? "pos" : null}
							>{fmtMoney(data.toBudget)}</span
						>
					</div>
				</div>
				{#if data.totalBudgeted > 0}
					<div class="abt-tab-overview-card-bar-wrap">
						<div
							class="abt-tab-overview-card-bar"
							style="width:{spentPctCapped}%"
							data-status={spentPct >= 100 ? "over" : spentPct >= 85 ? "warn" : "ok"}
						></div>
					</div>
				{/if}
				<div class="abt-tab-overview-bdr-list">
					<div class="abt-tab-overview-bdr">
						<span class="abt-tab-overview-bdr-op">→</span>
						<span class="abt-tab-overview-bdr-label">Available funds</span>
						<span class="abt-tab-overview-bdr-val abt-privacy-number"
							>{fmtMoney(data.availableFunds)}</span
						>
					</div>
					<div class="abt-tab-overview-bdr">
						<span class="abt-tab-overview-bdr-op">−</span>
						<span class="abt-tab-overview-bdr-label">Assigned to categories</span>
						<span class="abt-tab-overview-bdr-val abt-privacy-number"
							>{fmtMoney(data.totalBudgeted)}</span
						>
					</div>
					{#if data.lastMonthOverspent !== 0}
						<div class="abt-tab-overview-bdr">
							<span class="abt-tab-overview-bdr-op" style="color:var(--color-errorText,#e57373)"
								>−</span
							>
							<span class="abt-tab-overview-bdr-label">Last month overspent</span>
							<span class="abt-tab-overview-bdr-val abt-privacy-number" data-sign="neg"
								>{fmtMoney(Math.abs(data.lastMonthOverspent))}</span
							>
						</div>
					{/if}
					<div class="abt-tab-overview-bdr abt-tab-overview-bdr--total">
						<span class="abt-tab-overview-bdr-op">=</span>
						<span class="abt-tab-overview-bdr-label" style="font-weight:600">Available</span>
						<span
							class="abt-tab-overview-bdr-val abt-tab-overview-bdr-avail abt-privacy-number"
							data-sign={data.toBudget < 0 ? "neg" : data.toBudget > 0 ? "pos" : null}
							>{fmtMoney(data.toBudget)}</span
						>
					</div>
				</div>
				{#if data.bufferedSelected !== 0}
					<div class="abt-tab-overview-callout" data-type="success">
						✓ <span class="abt-privacy-number">{fmtMoney(data.bufferedSelected)}</span> saved for next
						month
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- ── Spending Pace ──────────────────────────────────────────── -->
	{#if data.totalBudgeted > 0}
		<div class="abt-tab-overview-cs">
			<button class="abt-tab-overview-sh" onclick={() => toggle("pace")}>
				<span class="abt-tab-overview-st">Spending Pace</span>
				{#if spentPct >= 100}
					<span class="abt-tab-overview-st-badge" data-status="over">over budget</span>
				{:else if spentAhead}
					<span class="abt-tab-overview-st-badge" data-status="warn">ahead of pace</span>
				{:else if isCurrentMonth}
					<span class="abt-tab-overview-st-badge" data-status="ok">on track</span>
				{/if}
				<svg
					class="abt-tab-overview-chevron"
					data-open={open("pace")}
					width="12"
					height="12"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<polyline
						points="2,4 6,8 10,4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			{#if open("pace")}
				<div class="abt-tab-overview-card">
					<div class="abt-tab-overview-pace-row">
						<span class="abt-tab-overview-pace-label">Spent</span>
						<span
							class="abt-tab-overview-pace-pct abt-privacy-number"
							data-sign={spentPct >= 100 ? "neg" : spentAhead ? "warn" : null}
							>{spentPctCapped}%</span
						>
					</div>
					<div class="abt-tab-overview-mini-bar-wrap">
						<div
							class="abt-tab-overview-mini-bar"
							style="width:{spentPctCapped}%"
							data-status={spentPct >= 100 ? "over" : spentAhead ? "warn" : "ok"}
						></div>
					</div>
					<div class="abt-tab-overview-pace-row" style="margin-top:8px">
						<span class="abt-tab-overview-pace-label">Month elapsed</span>
						<span class="abt-tab-overview-pace-pct">{monthElapsedPct}%</span>
					</div>
					<div class="abt-tab-overview-mini-bar-wrap">
						<div
							class="abt-tab-overview-mini-bar"
							style="width:{monthElapsedPct}%"
							data-status="elapsed"
						></div>
					</div>
					<div class="abt-tab-overview-pace-footer">
						<span class="abt-privacy-number"
							>{fmtMoney(data.totalSpent)} of {fmtMoney(data.totalBudgeted)}</span
						>
						{#if isCurrentMonth && daysLeft > 0}
							<span>{daysLeft}d left</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Next Month Coverage ────────────────────────────────────── -->
	{#if coverageTarget !== null && coverageTarget > 0}
		<div class="abt-tab-overview-cs">
			<button class="abt-tab-overview-sh" onclick={() => toggle("nextMonth")}>
				<span class="abt-tab-overview-st">Next Month Coverage</span>
				<svg
					class="abt-tab-overview-chevron"
					data-open={open("nextMonth")}
					width="12"
					height="12"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<polyline
						points="2,4 6,8 10,4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			{#if open("nextMonth")}
				<div class="abt-tab-overview-card">
					<!-- Month + method header -->
					<div class="abt-tab-overview-next-month-header">
						<span class="abt-tab-overview-next-month-name">{longMonth(data.nextMonthKey)}</span>
						<span class="abt-tab-overview-next-month-sub"
							>{useGoalTemplates ? "Remaining goal funding" : "Recent average"}</span
						>
					</div>

					<!-- Large % -->
					<div class="abt-tab-overview-next-hero">
						<span
							class="abt-tab-overview-next-pct abt-privacy-number"
							data-sign={nextOver >= 0 ? "pos" : "warn"}>{nextCoveragePct}%</span
						>
						<span class="abt-tab-overview-next-sub">prepared</span>
					</div>

					<!-- Status pill -->
					{#if nextOver >= 0}
						<div class="abt-tab-overview-pill abt-privacy-number" data-status="ok">
							+{fmtMoney(nextOver)} over target
						</div>
					{:else}
						<div class="abt-tab-overview-pill abt-privacy-number" data-status="warn">
							{fmtMoney(nextOver)} short
						</div>
					{/if}

					<!-- Progress bar -->
					<div class="abt-tab-overview-card-bar-wrap" style="margin-top:10px">
						<div
							class="abt-tab-overview-card-bar"
							style="width:{Math.max(0, Math.min(100, nextCoveragePct))}%"
							data-status={nextOver >= 0 ? "ok" : nextCoveragePct >= 70 ? "warn" : "over"}
						></div>
					</div>

					<!-- Amounts -->
					<div class="abt-tab-overview-next-amounts abt-privacy-number">
						{fmtMoney(data.nextMonthToBudget)} of {fmtMoney(coverageTarget)}
					</div>

					<!-- Summary sentence -->
					<div class="abt-tab-overview-next-summary abt-privacy-number">
						{#if nextOver >= 0}
							Fully prepared for {longMonth(data.nextMonthKey)} — {fmtMoney(nextOver)} over target.
						{:else}
							{fmtMoney(Math.abs(nextOver))} more needed to fully cover {longMonth(
								data.nextMonthKey,
							)}.
						{/if}
					</div>

					<!-- Breakdown -->
					{#if useGoalTemplates}
						<div class="abt-tab-overview-next-summary">
							Funds already assigned to next month’s goals have been deducted from the target.
						</div>
					{/if}
					<div class="abt-tab-overview-next-breakdown">
						<span class="abt-tab-overview-next-breakdown-label"
							>Ready to assign in {longMonth(data.nextMonthKey)}</span
						>
						<span class="abt-tab-overview-next-breakdown-val abt-privacy-number"
							>{fmtMoney(data.nextMonthToBudget)}</span
						>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="abt-tab-overview-cs">
			<div class="abt-tab-overview-sh">
				<span class="abt-tab-overview-st">Next Month Coverage</span>
			</div>
			<div class="abt-tab-overview-card">
				<div class="abt-tab-overview-next-summary">
					{#if coverageTarget === null}
						Unable to preview next month’s goal templates. Refresh to try again.
					{:else if useGoalTemplates}
						No additional goal funding needed for {longMonth(data.nextMonthKey)} after existing assignments.
					{:else}
						No spending history or budget available to calculate coverage.
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- ── Spending Trend ─────────────────────────────────────────── -->
	{#if data.trend.length > 0}
		<div class="abt-tab-overview-cs">
			<button class="abt-tab-overview-sh" onclick={() => toggle("spendTrend")}>
				<span class="abt-tab-overview-st">Spending Trend</span>
				<svg
					class="abt-tab-overview-chevron"
					data-open={open("spendTrend")}
					width="12"
					height="12"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<polyline
						points="2,4 6,8 10,4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			{#if open("spendTrend")}
				<div class="abt-tab-overview-card">
					<TrendChart
						trend={data.trend}
						valueKey="spent"
						currentMonthKey={data.monthKey}
						barColor="#7c3aed"
						barColorDim="rgba(124,58,237,0.35)"
						higherIsBad={true}
					/>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Budgeting Trend ────────────────────────────────────────── -->
	{#if data.trend.length > 0}
		<div class="abt-tab-overview-cs">
			<button class="abt-tab-overview-sh" onclick={() => toggle("budgetTrend")}>
				<span class="abt-tab-overview-st">Budgeting Trend</span>
				<svg
					class="abt-tab-overview-chevron"
					data-open={open("budgetTrend")}
					width="12"
					height="12"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<polyline
						points="2,4 6,8 10,4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			{#if open("budgetTrend")}
				<div class="abt-tab-overview-card">
					<TrendChart
						trend={data.trend}
						valueKey="budgeted"
						currentMonthKey={data.monthKey}
						barColor="#2563eb"
						barColorDim="rgba(37,99,235,0.35)"
					/>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Overspent ─────────────────────────────────────────────── -->
	{#if data.overspentCategories.length > 0}
		<div class="abt-tab-overview-cs">
			<button class="abt-tab-overview-sh" data-status="error" onclick={() => toggle("overspent")}>
				<span class="abt-tab-overview-st">Overspent</span>
				<span class="abt-tab-overview-st-count">({data.overspentCategories.length})</span>
				<svg
					class="abt-tab-overview-chevron"
					data-open={open("overspent")}
					width="12"
					height="12"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<polyline
						points="2,4 6,8 10,4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			{#if open("overspent")}
				<div class="abt-tab-overview-card">
					{#each data.overspentCategories as cat (cat.id)}
						{@const overPct = Math.round((Math.abs(cat.leftover) / maxOver) * 100)}
						<div class="abt-tab-overview-detail-row">
							<div class="abt-tab-overview-detail-header">
								<span class="abt-tab-overview-row-name">
									{cat.name}<span class="abt-tab-overview-row-meta">{cat.groupName}</span>
								</span>
								<span class="abt-tab-overview-row-value abt-privacy-number" data-sign="neg">
									{fmtMoney(cat.leftover)}
								</span>
							</div>
							<div class="abt-tab-overview-mini-bar-wrap">
								<div
									class="abt-tab-overview-mini-bar"
									style="width:{overPct}%"
									data-status="over"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Goals ─────────────────────────────────────────────────── -->
	{#if data.totalGoalCount > 0}
		<div class="abt-tab-overview-cs">
			<button class="abt-tab-overview-sh" onclick={() => toggle("goals")}>
				<span class="abt-tab-overview-st">Goals</span>
				{#if data.underfundedGoals.length > 0}
					<span class="abt-tab-overview-st-badge" data-status="warn"
						>{data.underfundedGoals.length} to fund</span
					>
				{:else}
					<span class="abt-tab-overview-st-badge" data-status="ok">all funded</span>
				{/if}
				<span class="abt-tab-overview-st-tally"
					>{data.fullyFundedGoalCount}/{data.totalGoalCount}</span
				>
				<svg
					class="abt-tab-overview-chevron"
					data-open={open("goals")}
					width="12"
					height="12"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<polyline
						points="2,4 6,8 10,4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			{#if open("goals")}
				<div class="abt-tab-overview-card">
					{#if data.underfundedGoals.length === 0}
						<div class="abt-tab-overview-all-funded-row">All goals met ✓</div>
					{:else}
						{#each data.underfundedGoals as cat (cat.id)}
							{@const funded = Math.max(0, cat.leftover)}
							{@const goalPct = cat.goal ? Math.min(100, Math.round((funded / cat.goal) * 100)) : 0}
							{@const needed = (cat.goal ?? 0) - cat.leftover}
							<div class="abt-tab-overview-detail-row">
								<div class="abt-tab-overview-detail-header">
									<span class="abt-tab-overview-row-name">{cat.name}</span>
									<span class="abt-tab-overview-row-value abt-privacy-number" data-sign="neg">
										needs {fmtMoney(needed)}
									</span>
								</div>
								<div class="abt-tab-overview-mini-bar-wrap">
									<div
										class="abt-tab-overview-mini-bar"
										style="width:{goalPct}%"
										data-status="goal"
									></div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Scheduled Transactions ─────────────────────────────────── -->
	<div class="abt-tab-overview-cs">
		<button class="abt-tab-overview-sh" onclick={() => toggle("upcoming")}>
			<span class="abt-tab-overview-st">Scheduled Transactions</span>
			{#if data.upcomingSchedules.length > 0}
				<span class="abt-tab-overview-st-count">({data.upcomingSchedules.length})</span>
			{/if}
			<svg
				class="abt-tab-overview-chevron"
				data-open={open("upcoming")}
				width="12"
				height="12"
				viewBox="0 0 12 12"
				aria-hidden="true"
			>
				<polyline
					points="2,4 6,8 10,4"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
		{#if open("upcoming")}
			<div class="abt-tab-overview-card">
				{#if data.upcomingSchedules.length > 0}
					{#each data.upcomingSchedules as s (s.id)}
						<div class="abt-tab-overview-sched-row">
							<span class="abt-tab-overview-sched-dot" aria-hidden="true"></span>
							<span class="abt-tab-overview-sched-date">{formatDate(s.nextDate)}</span>
							<span class="abt-tab-overview-sched-name">{s.name}</span>
						</div>
					{/each}
				{:else}
					<div class="abt-tab-overview-empty-row">
						No scheduled transactions in the next 30 days
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
