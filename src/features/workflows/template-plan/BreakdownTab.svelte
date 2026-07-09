<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";
	import { priorityKey, priorityLabel } from "@lib/utilities/template-plan/constants";
	import type { BreakdownSummary } from "@lib/utilities/template-plan/priority-plan";
	import { templatePlanState } from "./state.svelte";

	const breakdownState = $derived(templatePlanState.breakdownState);

	function formatAllocatedVsRequested(allocatedCents: number, requestedCents: number | null): string {
		if (requestedCents == null || allocatedCents === requestedCents) {
			return fmtMoney(allocatedCents);
		}
		return `${fmtMoney(allocatedCents)} / ${fmtMoney(requestedCents)}`;
	}

	function badgeChar(status: string): string {
		return status === "full" ? "✓" : status === "partial" ? "◐" : "○";
	}

	const rawGroups = $derived(
		breakdownState && Array.isArray(breakdownState.diff?.groups) ? breakdownState.diff.groups : [],
	);
	const changedGroups = $derived(
		rawGroups.map((g) => ({ ...g, rows: g.rows.filter((r) => r.delta !== 0) })).filter((g) => g.rows.length > 0),
	);
	const allEmpty = $derived(changedGroups.length === 0);
	const groupsToShow = $derived(templatePlanState.showAllRows ? rawGroups : changedGroups);

	function summaryHasTiers(summary: BreakdownSummary | null): summary is BreakdownSummary {
		return !!summary && Array.isArray(summary.tiers) && summary.tiers.length > 0;
	}
</script>

{#if templatePlanState.breakdownLoading}
	<div class="abt-tab-loading">
		<span class="abt-tab-spinner"></span>
		Computing breakdown…
	</div>
{:else if !breakdownState}
	<div class="abt-tab-empty">Apply or overwrite a template to see a breakdown here.</div>
{:else}
	{@const note = breakdownState.ctx.notification}
	{#if note?.message && (note.type === "error" || note.type === "warning")}
		<div class="abt-tab-notice" data-type={note.type}>{note.message}</div>
	{/if}

	{#if summaryHasTiers(breakdownState.ctx.priorityBreakdown)}
		{@const summary = breakdownState.ctx.priorityBreakdown}
		<div class="abt-tab-breakdown-priority">
			<div class="abt-tab-breakdown-priority-title">
				<span>Priority movement</span>
				<span class="abt-tab-breakdown-priority-total abt-privacy-number">
					{fmtMoney(summary.totalAllocatedCents, { sign: true })}
				</span>
			</div>

			{#each summary.tiers as tier (priorityKey(tier.priority))}
				<div class="abt-tab-breakdown-priority-tier" data-status={tier.status}>
					<div class="abt-tab-breakdown-priority-tier-header">
						<span class="abt-tab-prio-badge" data-status={tier.status}>{badgeChar(tier.status ?? "none")}</span>
						<span class="abt-tab-breakdown-priority-tier-label">{priorityLabel(tier.priority)}</span>
						<span class="abt-tab-breakdown-priority-tier-amount abt-privacy-number">
							{formatAllocatedVsRequested(tier.allocatedCents, tier.hasUnknownDemand ? null : tier.requestedCents)}
						</span>
					</div>
					<div class="abt-tab-breakdown-priority-rows">
						{#each tier.rows as row (row.catId)}
							<div class="abt-tab-breakdown-priority-row" data-status={row.status}>
								<span class="abt-tab-breakdown-priority-row-name">{row.catName}</span>
								<span class="abt-tab-breakdown-priority-row-amount abt-privacy-number">
									{formatAllocatedVsRequested(row.allocatedCents, row.requestedCents)}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if groupsToShow.length === 0}
		<div class="abt-tab-empty">{allEmpty ? "No category budgets changed." : "No categories to show."}</div>
	{:else}
		{#each groupsToShow as g (g.id)}
			<div class="abt-tab-group">
				<div class="abt-tab-group-name">{g.name}</div>
				{#each templatePlanState.showAllRows ? g.rows : g.rows.filter((r) => r.delta !== 0) as r (r.id)}
					{@const sign = r.delta > 0 ? "pos" : r.delta < 0 ? "neg" : "zero"}
					<div class="abt-tab-row" data-changed={String(r.delta !== 0)}>
						<span class="abt-tab-row-name">{r.name}</span>
						<span class="abt-tab-row-delta abt-privacy-number" data-sign={sign}>
							{r.delta === 0 ? fmtMoney(r.after) : fmtMoney(r.delta, { sign: true })}
						</span>
					</div>
				{/each}
			</div>
		{/each}
	{/if}
{/if}
