<script lang="ts">
	import Badge from "@lib/components/panel/Badge.svelte";
	import Callout from "@lib/components/panel/Callout.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { priorityKey, priorityLabel } from "@lib/utilities/template-plan/constants";
	import type { BreakdownSummary } from "@lib/utilities/template-plan/priority-plan";
	import { statusBadge, statusTone } from "./status";
	import { templatePlanState } from "./state.svelte";

	const breakdownState = $derived(templatePlanState.breakdownState);

	function formatAllocatedVsRequested(
		allocatedCents: number,
		requestedCents: number | null,
	): string {
		if (requestedCents == null || allocatedCents === requestedCents) {
			return fmtMoney(allocatedCents);
		}
		return `${fmtMoney(allocatedCents)} / ${fmtMoney(requestedCents)}`;
	}

	const rawGroups = $derived(
		breakdownState && Array.isArray(breakdownState.diff?.groups) ? breakdownState.diff.groups : [],
	);
	const changedGroups = $derived(
		rawGroups
			.map((g) => ({ ...g, rows: g.rows.filter((r) => r.delta !== 0) }))
			.filter((g) => g.rows.length > 0),
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
		<div class="abt-tab-pad">
			<Callout tone={note.type === "error" ? "negative" : "warning"}>{note.message}</Callout>
		</div>
	{/if}

	{#if summaryHasTiers(breakdownState.ctx.priorityBreakdown)}
		{@const summary = breakdownState.ctx.priorityBreakdown}
		<Section title="Priority Movement">
			{#snippet trailing()}{fmtMoney(summary.totalAllocatedCents, { sign: true })}{/snippet}
			{#each summary.tiers as tier (priorityKey(tier.priority))}
				{@const badge = statusBadge(tier.status)}
				<Row
					name={priorityLabel(tier.priority)}
					strong
					value={formatAllocatedVsRequested(
						tier.allocatedCents,
						tier.hasUnknownDemand ? null : tier.requestedCents,
					)}
					tone={statusTone(tier.status)}
				>
					{#snippet leading()}<Badge tone={badge.tone}>{badge.label}</Badge>{/snippet}
				</Row>
				{#each tier.rows as row (row.catId)}
					<Row
						name={row.catName}
						indent
						value={formatAllocatedVsRequested(row.allocatedCents, row.requestedCents)}
						tone={statusTone(row.status)}
					/>
				{/each}
			{/each}
		</Section>
	{/if}

	{#if groupsToShow.length === 0}
		<div class="abt-tab-empty">
			{allEmpty ? "No category budgets changed." : "No categories to show."}
		</div>
	{:else}
		{#each groupsToShow as g (g.id)}
			{@const rows = templatePlanState.showAllRows ? g.rows : g.rows.filter((r) => r.delta !== 0)}
			<Section title={g.name} count={rows.length}>
				{#each rows as r (r.id)}
					<Row
						name={r.name}
						dim={r.delta === 0}
						value={r.delta === 0 ? fmtMoney(r.after) : fmtMoney(r.delta, { sign: true })}
						tone={r.delta > 0 ? "positive" : r.delta < 0 ? "negative" : "muted"}
					/>
				{/each}
			</Section>
		{/each}
	{/if}
{/if}
