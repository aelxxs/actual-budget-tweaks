<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import { fmtMoney } from "@lib/utilities/currency";
	import { monthLabelForHeader } from "@lib/utilities/template-plan/actual-data";
	import { setValue } from "@lib/utilities/store";
	import BreakdownTab from "./BreakdownTab.svelte";
	import { TAB_STORAGE_KEY } from "./constants";
	import OverviewTab from "./OverviewTab.svelte";
	import PriorityTab from "./PriorityTab.svelte";
	import { templatePlanState } from "./state.svelte";

	function actionLabel(kind: string): string {
		switch (kind) {
			case "overwrite":
				return "Overwrote with template";
			case "apply-single":
				return "Applied template (single)";
			case "apply-group":
				return "Applied templates (group)";
			default:
				return "Applied template";
		}
	}

	// The month, since the tabs already say which view this is; Breakdown reports the last
	// template run, which can be another month, so it names the run too.
	const title = $derived.by(() => {
		const rawMonthLabel =
			(templatePlanState.activeTab === "breakdown" &&
				templatePlanState.breakdownState?.ctx.month) ||
			(templatePlanState.activeTab === "overview" && templatePlanState.overviewData?.monthKey) ||
			templatePlanState.priorityData?.month ||
			null;
		const monthLabel = monthLabelForHeader(rawMonthLabel ?? null);
		const run = templatePlanState.breakdownState;
		if (templatePlanState.activeTab === "breakdown" && run) {
			return monthLabel
				? `${actionLabel(run.ctx.kind)} · ${monthLabel}`
				: actionLabel(run.ctx.kind);
		}
		return monthLabel ?? "Insights";
	});

	const TABS = [
		{ value: "overview", label: "Overview" },
		{ value: "breakdown", label: "Breakdown" },
		{ value: "priority", label: "Priority plan" },
	] as const;

	function selectTab(tab: (typeof TABS)[number]["value"]) {
		if (tab === templatePlanState.activeTab) return;
		templatePlanState.activeTab = tab;
		setValue(TAB_STORAGE_KEY, tab);
		templatePlanState.onTabChange?.(tab);
	}

	$effect(() => {
		sidepanel.setTitle(title);
	});

	// Refreshing data that's already on screen: dimmed until the new numbers arrive.
	const updating = $derived(
		templatePlanState.activeTab === "overview"
			? templatePlanState.overviewLoading && !!templatePlanState.overviewData
			: templatePlanState.activeTab === "priority"
				? templatePlanState.priorityLoading && !!templatePlanState.priorityData
				: false,
	);

	const showFooter = $derived(
		templatePlanState.activeTab === "breakdown" && !!templatePlanState.breakdownState,
	);
</script>

<div class="ip-tabs">
	<div class="abt-seg" role="group" aria-label="Insights view">
		{#each TABS as tab (tab.value)}
			<button
				type="button"
				aria-pressed={templatePlanState.activeTab === tab.value}
				onclick={() => selectTab(tab.value)}>{tab.label}</button
			>
		{/each}
	</div>
</div>

<div class="abt-tab-body" data-updating={updating || undefined} aria-busy={updating}>
	{#if templatePlanState.activeTab === "overview"}
		<OverviewTab />
	{:else if templatePlanState.activeTab === "breakdown"}
		<BreakdownTab />
	{:else}
		<PriorityTab />
	{/if}
</div>

{#if showFooter}
	<div class="abt-tab-footer">
		<span class="abt-tab-footer-label">Total allocated</span>
		<span class="abt-tab-footer-value abt-privacy-number">
			{fmtMoney(templatePlanState.breakdownState!.diff.totalAllocated, { sign: true })}
		</span>
	</div>

	<button
		type="button"
		class="abt-tab-toggle"
		onclick={() => (templatePlanState.showAllRows = !templatePlanState.showAllRows)}
	>
		{templatePlanState.showAllRows ? "Show only changed" : "Show unchanged categories"}
	</button>
{/if}

<style>
	.ip-tabs {
		flex-shrink: 0;
		padding: 10px 12px 6px;
	}

	/* Full width: the panel's views, not a compact option picker. */
	.ip-tabs .abt-seg {
		display: flex;
		width: 100%;
	}

	.ip-tabs .abt-seg > button {
		flex: 1;
		justify-content: center;
	}
</style>
