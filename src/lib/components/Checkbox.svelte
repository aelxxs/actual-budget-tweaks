<script lang="ts">
	import { onMount } from "svelte";
	import { SettingContext } from "../scripts/types";
	import { getValue } from "../utilities/store";

	const { labelText, ctx, onChange } = $props<{
		labelText: string;
		ctx: SettingContext;
		onChange: (value: boolean, ctx: any) => void;
	}>();
	let value = $state(false);

	onMount(async () => {
		const saved = await getValue(ctx.key, ctx.defaultValue);
		value = Boolean(saved);
	});

	async function handleChange(event: Event) {
		const newValue = (event.target as HTMLInputElement).checked;
		await onChange(newValue, ctx);
		value = newValue;
	}
</script>

<div class="cluster" style="--gutter: 0.25rem;">
	<input type="checkbox" class="checkbox" bind:checked={value} onchange={handleChange} />
	<span>{labelText}</span>
</div>

<style>
	.checkbox {
		position: relative;
		margin: 0 6px 0 0;
		flex-shrink: 0;
		width: 15px;
		height: 15px;
		appearance: none;
		outline: 0;
		border: 1px solid var(--color-formInputBorder);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-checkboxText);
		background-color: var(--color-tableBackground);
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s;
	}
	.checkbox:checked {
		border: 1px solid var(--color-checkboxBorderSelected);
		background-color: var(--color-checkboxBackgroundSelected);
	}
	.checkbox:checked::after {
		display: block;
		background: var(--color-checkboxBackgroundSelected)
			url('data:image/svg+xml; utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="white" d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>')
			9px 9px;
		width: 9px;
		height: 9px;
		content: " ";
	}
</style>
