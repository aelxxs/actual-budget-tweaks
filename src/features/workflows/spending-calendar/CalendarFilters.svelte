<script lang="ts">
	import FilterPopover from "@features/workflows/filters/FilterPopover.svelte";
	import FilterToggle from "@features/workflows/filters/FilterToggle.svelte";
	import type { FilterAccount } from "@features/workflows/filters/filter-trees";
	import type { Category, CategoryGroup } from "@lib/types/actual-schema";
	import { CLEARED, type CalendarFilters } from "./filters";

	let {
		open = $bindable(false),
		filters,
		accounts,
		categories,
		categoryGroups,
		onChange,
	}: {
		open?: boolean;
		filters: CalendarFilters;
		accounts: FilterAccount[];
		categories: Pick<Category, "id" | "name" | "group">[];
		categoryGroups: Pick<CategoryGroup, "id" | "name">[];
		onChange: (patch: Partial<CalendarFilters>) => void;
	} = $props();
</script>

<FilterPopover
	bind:open
	{filters}
	{accounts}
	{categories}
	{categoryGroups}
	{onChange}
	onClear={() => onChange(CLEARED)}
	extraActive={!filters.showScheduled}
>
	{#snippet toggles()}
		<FilterToggle
			label="Scheduled bills"
			checked={filters.showScheduled}
			onCheckedChange={(showScheduled) => onChange({ showScheduled })}
		/>
		<FilterToggle
			label="Off-budget accounts"
			checked={!filters.hideOffBudget}
			onCheckedChange={(checked) => onChange({ hideOffBudget: !checked })}
		/>
		<FilterToggle
			label="Daily balance"
			title="Closing balance each day"
			hint="Across the accounts shown"
			checked={filters.showBalance}
			onCheckedChange={(showBalance) => onChange({ showBalance })}
		/>
	{/snippet}
</FilterPopover>
