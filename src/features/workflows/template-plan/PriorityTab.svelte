<script lang="ts">
	import Badge from "@lib/components/panel/Badge.svelte";
	import Callout from "@lib/components/panel/Callout.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { setValue } from "@lib/utilities/store";
	import { priorityKey, priorityLabel } from "@lib/utilities/template-plan/constants";
	import { statusFor, type SummaryTier } from "@lib/utilities/template-plan/priority-plan";
	import { PRIO_COLLAPSE_STORAGE_KEY } from "./constants";
	import { statusBadge, statusTone } from "./status";
	import { templatePlanState } from "./state.svelte";
	import TabSkeleton from "./TabSkeleton.svelte";

	const data = $derived(templatePlanState.priorityData);

	function isTierCollapsed(tier: SummaryTier): boolean {
		const override = templatePlanState.prioCollapseOverrides[priorityKey(tier.priority)];
		if (override != null) return override;
		return tier.status === "full";
	}

	function setTierOpen(tier: SummaryTier, open: boolean): void {
		templatePlanState.prioCollapseOverrides[priorityKey(tier.priority)] = !open;
		setValue(PRIO_COLLAPSE_STORAGE_KEY, { ...templatePlanState.prioCollapseOverrides });
	}

	function allocatedVsRequested(allocatedCents: number, requestedCents: number): string {
		return allocatedCents === requestedCents
			? fmtMoney(requestedCents)
			: `${fmtMoney(allocatedCents)} / ${fmtMoney(requestedCents)}`;
	}

	function rowMeta(row: SummaryTier["rows"][number], tier: SummaryTier): string | null {
		const otherPriorities = row.priorities.filter((p) => p !== tier.priority && p != null);
		if (otherPriorities.length > 0) return `also @ ${otherPriorities.join(", ")}`;
		if (row.source === "goal-cell") return "goal-cell estimate";
		if (row.source === "goal-residual") return "goal residual";
		if (row.source === "parsed-amount") return "parsed estimate";
		if (row.templateCount > 1) return `${row.templateCount} templates`;
		return null;
	}
</script>

{#if !data}
	<TabSkeleton tab="priority" />
{:else if !data.ok}
	<div class="abt-tab-empty">{data.reason || "Unavailable"}</div>
{:else}
	<Section title="Plan Summary">
		<Row name="Template demand" value={fmtMoney(data.totalRequestedCents ?? 0)} />
		<Row
			name="Will allocate"
			value={fmtMoney(data.totalAllocatedCents ?? 0)}
			tone={(data.totalAllocatedCents ?? 0) > 0 ? "positive" : "warning"}
		/>
		<Row
			name="Gap remaining"
			value={fmtMoney(data.gapCents ?? 0)}
			tone={(data.gapCents ?? 0) > 0 ? "warning" : "positive"}
		/>
		<Row
			name="Budgetable funds"
			value={fmtMoney(data.budgetableCents ?? 0)}
			tone={(data.budgetableCents ?? 0) < 0 ? "warning" : "positive"}
		/>

		{#if !data.tiers || data.tiers.length === 0}
			<Callout tone="positive">No templates found.</Callout>
		{:else if data.watermark == null}
			<Callout tone="positive">
				All {data.tiers.length} tier{data.tiers.length === 1 ? "" : "s"} funded by the overwrite plan.
			</Callout>
		{:else}
			{@const watermarkTier = data.tiers.find((t) => t.priority === data.watermark)}
			{@const fundedThrough =
				data.highestFundedPriority != null
					? `Funded through priority ${data.highestFundedPriority}. `
					: ""}
			{#if watermarkTier?.status === "partial"}
				<Callout tone="warning">
					{fundedThrough}{priorityLabel(data.watermark)} partially allocated.
				</Callout>
			{:else}
				<Callout tone="negative">
					{fundedThrough}{priorityLabel(data.watermark)}+ unfunded.
				</Callout>
			{/if}
		{/if}

		<Callout>
			{#if data.usedDryRun}
				{#if (data.fallbackCount ?? 0) > 0}
					Assumes month-wide overwrite; {data.fallbackCount} categor{data.fallbackCount === 1
						? "y uses"
						: "ies use"}
					goal-cell estimates.
				{:else}
					Assumes month-wide overwrite with budget template.
				{/if}
			{:else}
				Estimate uses goal cells because dry-run data was unavailable.
			{/if}
		</Callout>
	</Section>

	{#if !data.tiers || data.tiers.length === 0}
		<div class="abt-tab-empty">No #template lines detected in category notes.</div>
	{:else}
		{#each data.tiers as tier (priorityKey(tier.priority))}
			{@const badge = statusBadge(tier.status)}
			<Section
				title={priorityLabel(tier.priority)}
				open={!isTierCollapsed(tier)}
				onToggle={(open) => setTierOpen(tier, open)}
				count={`${tier.rows.length} cat${tier.rows.length === 1 ? "" : "s"}`}
			>
				{#snippet badges()}<Badge tone={badge.tone}>{badge.label}</Badge>{/snippet}
				{#snippet trailing()}{allocatedVsRequested(
						tier.allocatedCents,
						tier.requestedCents,
					)}{/snippet}
				{#each tier.rows as row (row.catId)}
					{@const status = statusFor(row.requestedCents, row.allocatedCents)}
					<Row
						name={row.catName}
						meta={rowMeta(row, tier)}
						value={allocatedVsRequested(row.allocatedCents, row.requestedCents)}
						tone={statusTone(status)}
						dim={status === "none" || tier.status === "none"}
					/>
				{/each}
			</Section>
		{/each}
	{/if}
{/if}
