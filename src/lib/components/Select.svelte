<script lang="ts">
	import { onMount } from "svelte";
	import type { SelectSetting } from "../../features/types";
	import { applySettingChange } from "../../features/runtime";
	import { getValue } from "../utilities/store";

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { labelText, options, setting } = $props<{
		labelText: string;
		options: { value: string; label: string }[];
		setting: SelectSetting<any>;
	}>();
	const ctx = setting.context;

	// local reactive state for select value
	let value = $state("");

	// initialize from storage on mount
	onMount(async () => {
		const saved = await getValue(ctx.key, ctx.defaultValue);
		value = typeof saved === "string" ? saved : "";
	});

	async function handleChange(event: Event) {
		const newValue = (event.target as HTMLSelectElement).value;
		await applySettingChange(setting, newValue);
		value = newValue;
	}
</script>

<div class="stack" data-testid={ctx.key}>
	<span style="font-weight: 500;">{labelText}</span>
	<select bind:value class="select" onchange={handleChange}>
		{#each options as option}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>

<style>
	.select {
		padding: 0.45rem 0.75rem;
		font-size: 1em;
		background-color: var(--color-buttonNormalBackground);
		border: 1px solid var(--color-buttonNormalBorder);
		border-radius: 4px;
		color: var(--color-buttonNormalText);
	}
</style>
