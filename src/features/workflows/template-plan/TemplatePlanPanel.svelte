<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import Tabs from "@lib/components/Tabs.svelte";
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

	const title = $derived.by(() => {
		const rawMonthLabel =
			(templatePlanState.activeTab === "breakdown" &&
				templatePlanState.breakdownState?.ctx.month) ||
			(templatePlanState.activeTab === "overview" && templatePlanState.overviewData?.monthKey) ||
			templatePlanState.priorityData?.month ||
			null;
		const monthLabel = monthLabelForHeader(rawMonthLabel ?? null);
		const headerTitleText =
			templatePlanState.activeTab === "breakdown" && templatePlanState.breakdownState
				? actionLabel(templatePlanState.breakdownState.ctx.kind)
				: templatePlanState.activeTab === "overview"
					? "Overview"
					: templatePlanState.activeTab === "priority"
						? "Priority plan"
						: "Breakdown";
		return monthLabel ? `${headerTitleText} • ${monthLabel}` : headerTitleText;
	});

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

<Tabs
	tabs={[
		{ value: "overview", label: "Overview" },
		{ value: "breakdown", label: "Breakdown" },
		{ value: "priority", label: "Priority plan" },
	]}
	bind:value={templatePlanState.activeTab}
	onChange={(tab) => {
		setValue(TAB_STORAGE_KEY, tab);
		templatePlanState.onTabChange?.(tab);
	}}
/>

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
