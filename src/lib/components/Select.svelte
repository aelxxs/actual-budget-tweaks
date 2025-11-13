<script lang="ts">
	import { onMount } from "svelte";
	import { SettingContext } from "../scripts/types";
	import { getValue, setValue } from "../utilities/store";

	// receive props in runes mode
	const props = $props();
	const labelText: string = props.labelText;
	const options: { value: string; label: string }[] = props.options;
	const ctx: SettingContext = props.ctx;
	const onChange: (value: string, ctx: any) => void = props.onChange;

	// local reactive state for select value
	let value = $state(ctx.defaultValue);

	// initialize from storage on mount
	onMount(async () => {
		const saved = await getValue(ctx.key, ctx.defaultValue);
		value = saved;
	});

	async function handleChange(event: Event) {
		const newValue = (event.target as HTMLSelectElement).value;
		await onChange(newValue, ctx);
		value = newValue;
		setValue(ctx.key, newValue); // persist if desired
	}
</script>

<div class="stack">
	<span style="font-weight: 500;">{labelText}</span>
	<select {value} class="select" onchange={handleChange}>
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
		border: var(--border);
		border-radius: 4px;
		color: var(--color-buttonNormalText);
	}
</style>
