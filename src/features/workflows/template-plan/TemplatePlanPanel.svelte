<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import Tabs from "@lib/components/Tabs.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { monthLabelForHeader } from "@lib/template-plan/actual-data";
	import { setValue } from "@lib/utilities/store";
	import BreakdownTab from "./BreakdownTab.svelte";
	import CardsMenu from "./CardsMenu.svelte";
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
			case "fund":
				return "Funded targets";
			case "cover":
				return "Covered overspending";
			default:
				return "Applied template";
		}
	}

	// The month, since the tabs already say which view this is; Breakdown reports the last
	// template run, which can be another month, so it names the run too.
	const { onTitle }: { onTitle: (title: string) => void } = $props();

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

	$effect(() => {
		onTitle(title);
	});

	// Refreshing data that's already on screen: dimmed until the new numbers arrive.
	const updating = $derived(
		templatePlanState.activeTab === "overview"
			? templatePlanState.overviewLoading && !!templatePlanState.overviewData
			: templatePlanState.activeTab === "priority"
				? templatePlanState.priorityLoading && !!templatePlanState.priorityData
				: false,
	);

	let customizeButton = $state<HTMLElement>();

	const showFooter = $derived(
		templatePlanState.activeTab === "breakdown" && !!templatePlanState.breakdownState,
	);
</script>

<Tabs
	tabs={templatePlanState.trackingBudget
		? [
				{ value: "overview", label: "Overview" },
				{ value: "breakdown", label: "Breakdown" },
			]
		: [
				{ value: "overview", label: "Overview" },
				{ value: "breakdown", label: "Breakdown" },
				{ value: "priority", label: "Priority plan" },
			]}
	bind:value={templatePlanState.activeTab}
	onChange={(tab) => {
		setValue(TAB_STORAGE_KEY, tab);
		templatePlanState.onTabChange?.(tab);
	}}
>
	{#snippet trailing()}
		{#if templatePlanState.activeTab === "overview"}
			<div class="abt-tab-actions">
				<button
					bind:this={customizeButton}
					type="button"
					class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
					aria-pressed={templatePlanState.customizingCards}
					onclick={() => (templatePlanState.customizingCards = !templatePlanState.customizingCards)}
					title="Customize cards"
					aria-label="Customize cards"
				>
					<Icon name="sliders" size={13} />
				</button>
			</div>
			{#if templatePlanState.customizingCards && customizeButton}
				<CardsMenu anchor={customizeButton} />
			{/if}
		{/if}
	{/snippet}
</Tabs>

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
