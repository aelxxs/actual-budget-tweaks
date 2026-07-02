<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import Tabs from "@lib/components/Tabs.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { monthLabelForHeader } from "@lib/utilities/template-plan/actual-data";
	import { setValue } from "@lib/utilities/store";
	import BreakdownTab from "./BreakdownTab.svelte";
	import { TAB_STORAGE_KEY } from "./constants";
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
			(templatePlanState.activeTab === "breakdown" && templatePlanState.breakdownState?.ctx.month) ||
			templatePlanState.priorityData?.month ||
			null;
		const monthLabel = monthLabelForHeader(rawMonthLabel ?? null);
		const headerTitleText =
			templatePlanState.activeTab === "breakdown" && templatePlanState.breakdownState
				? actionLabel(templatePlanState.breakdownState.ctx.kind)
				: "Template plan";
		return monthLabel ? `${headerTitleText} • ${monthLabel}` : headerTitleText;
	});

	$effect(() => {
		sidepanel.setTitle(title);
	});

	const showFooter = $derived(templatePlanState.activeTab === "breakdown" && !!templatePlanState.breakdownState);
</script>

<Tabs
	tabs={[
		{ value: "breakdown", label: "Breakdown" },
		{ value: "priority", label: "Priority plan" },
	]}
	bind:value={templatePlanState.activeTab}
	onChange={(tab) => setValue(TAB_STORAGE_KEY, tab)}
/>

<div class="abt-tab-body">
	{#if templatePlanState.activeTab === "breakdown"}
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
