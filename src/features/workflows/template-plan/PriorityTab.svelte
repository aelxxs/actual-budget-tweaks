<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { setValue } from "@lib/utilities/store";
	import { priorityKey, priorityLabel } from "@lib/utilities/template-plan/constants";
	import { statusFor, type SummaryTier } from "@lib/utilities/template-plan/priority-plan";
	import { PRIO_COLLAPSE_STORAGE_KEY } from "./constants";
	import { templatePlanState } from "./state.svelte";

	const data = $derived(templatePlanState.priorityData);

	function isTierCollapsed(tier: SummaryTier): boolean {
		const override = templatePlanState.prioCollapseOverrides[priorityKey(tier.priority)];
		if (override != null) return override;
		return tier.status === "full";
	}

	function toggleTierCollapsed(tier: SummaryTier): void {
		const key = priorityKey(tier.priority);
		templatePlanState.prioCollapseOverrides[key] = !isTierCollapsed(tier);
		setValue(PRIO_COLLAPSE_STORAGE_KEY, { ...templatePlanState.prioCollapseOverrides });
	}

	function badgeChar(status: string | undefined): string {
		return status === "full" ? "✓" : status === "partial" ? "◐" : "○";
	}
</script>

{#if !data}
	<div class="abt-tab-loading">
		<span class="abt-tab-spinner"></span>
		Computing template plan…
	</div>
{:else if !data.ok}
	<div class="abt-tab-empty">{data.reason || "Unavailable"}</div>
{:else}
	<div class="abt-tab-prio-summary">
		<div class="abt-tab-prio-summary-label">Template demand</div>
		<div class="abt-tab-prio-summary-value abt-privacy-number">{fmtMoney(data.totalRequestedCents ?? 0)}</div>

		<div class="abt-tab-prio-summary-label">Will allocate</div>
		<div
			class="abt-tab-prio-summary-value abt-privacy-number"
			data-status={(data.totalAllocatedCents ?? 0) > 0 ? "ok" : "gap"}
		>
			{fmtMoney(data.totalAllocatedCents ?? 0)}
		</div>

		<div class="abt-tab-prio-summary-label">Gap remaining</div>
		<div
			class="abt-tab-prio-summary-value abt-privacy-number"
			data-status={(data.gapCents ?? 0) > 0 ? "gap" : "ok"}
		>
			{fmtMoney(data.gapCents ?? 0)}
		</div>

		<div class="abt-tab-prio-summary-label">Budgetable funds</div>
		<div
			class="abt-tab-prio-summary-value abt-privacy-number"
			data-status={(data.budgetableCents ?? 0) < 0 ? "gap" : "ok"}
		>
			{fmtMoney(data.budgetableCents ?? 0)}
		</div>

		{#if !data.tiers || data.tiers.length === 0}
			<div class="abt-tab-prio-watermark" data-status="full">No templates found.</div>
		{:else if data.watermark == null}
			<div class="abt-tab-prio-watermark" data-status="full">
				All {data.tiers.length} tier{data.tiers.length === 1 ? "" : "s"} funded by the overwrite plan.
			</div>
		{:else}
			{@const watermarkTier = data.tiers.find((t) => t.priority === data.watermark)}
			{@const hf = data.highestFundedPriority}
			{#if watermarkTier?.status === "partial"}
				<div class="abt-tab-prio-watermark" data-status="partial">
					{hf != null ? `Funded through priority ${hf}. ` : ""}{priorityLabel(data.watermark)} partially allocated.
				</div>
			{:else}
				<div class="abt-tab-prio-watermark" data-status="none">
					{hf != null ? `Funded through priority ${hf}. ` : ""}{priorityLabel(data.watermark)}+ unfunded.
				</div>
			{/if}
		{/if}
		<div class="abt-tab-prio-mode">
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
		</div>
	</div>

	{#if !data.tiers || data.tiers.length === 0}
		<div class="abt-tab-empty">No #template lines detected in category notes.</div>
	{:else}
		{#each data.tiers as tier (priorityKey(tier.priority))}
			{@const collapsed = isTierCollapsed(tier)}
			<div class="abt-tab-prio-tier" data-status={tier.status} data-collapsed={String(collapsed)}>
				<button
					type="button"
					class="abt-tab-prio-tier-header"
					aria-expanded={!collapsed}
					onclick={() => toggleTierCollapsed(tier)}
				>
					<span class="abt-tab-prio-chevron" aria-hidden="true">
						<Icon name="chevronRight" size={10} />
					</span>
					<span class="abt-tab-prio-badge" data-status={tier.status}>{badgeChar(tier.status)}</span>
					<span class="abt-tab-prio-tier-label">{priorityLabel(tier.priority)}</span>
					<span class="abt-tab-prio-tier-meta">{tier.rows.length} cat{tier.rows.length === 1 ? "" : "s"}</span
					>
					<span class="abt-tab-prio-tier-amount abt-privacy-number">
						{tier.allocatedCents === tier.requestedCents
							? fmtMoney(tier.requestedCents)
							: `${fmtMoney(tier.allocatedCents)} / ${fmtMoney(tier.requestedCents)}`}
					</span>
				</button>

				<div class="abt-tab-prio-tier-rows">
					{#each tier.rows as row (row.catId)}
						{@const otherPriorities = row.priorities.filter((p) => p !== tier.priority && p != null)}
						{@const multiPrio = otherPriorities.length > 0}
						{@const metaText = multiPrio
							? `also @ ${otherPriorities.join(", ")}`
							: row.source === "goal-cell"
								? "goal-cell estimate"
								: row.source === "goal-residual"
									? "goal residual"
									: row.source === "parsed-amount"
										? "parsed estimate"
										: row.templateCount > 1
											? `${row.templateCount} templates`
											: null}
						<div class="abt-tab-prio-row" data-status={statusFor(row.requestedCents, row.allocatedCents)}>
							<span class="abt-tab-prio-row-name">
								{row.catName}
								{#if metaText}
									<span class="abt-tab-prio-row-meta">{metaText}</span>
								{/if}
							</span>
							<span class="abt-tab-prio-row-amount abt-privacy-number">
								{row.allocatedCents === row.requestedCents
									? fmtMoney(row.requestedCents)
									: `${fmtMoney(row.allocatedCents)} / ${fmtMoney(row.requestedCents)}`}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
{/if}
