<script lang="ts" module>
	export interface PickerGroup {
		id: string;
		name: string;
		categories: { id: string; name: string }[];
	}
</script>

<script lang="ts">
	import CategoryIcon from "./CategoryIcon.svelte";
	import Picker from "./Picker.svelte";

	/** A category chooser with search, grouped as the budget shows them. */
	const {
		groups,
		value,
		label,
		placeholder = "Choose a category",
		disabled = false,
		attention = false,
		clearLabel,
		onPick,
	}: {
		groups: PickerGroup[];
		value: string | null;
		/** What the choice is for, read out by screen readers. */
		label: string;
		placeholder?: string;
		disabled?: boolean;
		/** Marks the trigger, e.g. while the transaction still needs a category. */
		attention?: boolean;
		/** Offers clearing the category, under this name, ahead of the groups. */
		clearLabel?: string;
		onPick: (id: string | null) => void;
	} = $props();

	const sections = $derived(groups.map((g) => ({ id: g.id, name: g.name, items: g.categories })));
</script>

<Picker
	{sections}
	{value}
	{label}
	{placeholder}
	{disabled}
	{attention}
	{clearLabel}
	{onPick}
	searchLabel="Search categories"
	noun="categories"
>
	{#snippet icon(id)}
		<CategoryIcon {id} />
	{/snippet}
</Picker>
