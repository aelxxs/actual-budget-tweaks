<script lang="ts">
	import { onMount } from "svelte";
	import type { SelectSetting } from "../../features/types";
	import { applySettingChange } from "../../features/runtime";
	import { getValue } from "../utilities/store";
	import Icon from "./Icon.svelte";
	import type { IconName } from "../icons";

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { labelText, options, setting, icon } = $props<{
		labelText: string;
		options: { value: string; label: string }[];
		setting: SelectSetting<any>;
		icon?: IconName;
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

<div class="stack select-row" data-testid={ctx.key}>
	<span class="select-label-row">
		{#if icon}
			<span class="select-icon"><Icon name={icon} size={15} /></span>
		{/if}
		<span class="select-label-group">
			<span class="select-label">{labelText}</span>
			{#if setting.description}
				<span class="select-desc">{setting.description}</span>
			{/if}
		</span>
	</span>
	<select bind:value class="select" onchange={handleChange}>
		{#each options as option}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>

<style>
	.select-row {
		gap: 6px;
		padding: 8px;
		margin: 0 -8px;
		border-radius: 6px;
		border-top: 1px solid color-mix(in srgb, var(--color-pageText) 7%, transparent);
	}

	.select-row:first-child {
		border-top: none;
	}

	.select-label-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.select-icon {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--color-pageTextSubdued);
	}

	.select-label-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.select-label {
		font-size: 13px;
		font-weight: 500;
	}

	.select-desc {
		font-size: 11px;
		font-weight: 400;
		color: var(--color-pageTextSubdued);
	}

	.select {
		padding: 0.45rem 0.75rem;
		font-size: 1em;
		background-color: var(--color-buttonNormalBackground);
		border: 1px solid var(--color-buttonNormalBorder);
		border-radius: 4px;
		color: var(--color-buttonNormalText);
	}
</style>
