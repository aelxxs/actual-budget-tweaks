<script lang="ts">
	import { onMount } from "svelte";
	import type { SelectSetting } from "../../features/types";
	import { applySettingChange } from "../../features/runtime";
	import { getValue, watchValue } from "../utilities/store";
	import Icon from "./Icon.svelte";
	import type { IconName } from "../icons";

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

	$effect(() =>
		watchValue(ctx.key, (v) => {
			const next = v ?? ctx.defaultValue;
			value = typeof next === "string" ? next : "";
		}),
	);

	async function handleChange(event: Event) {
		const newValue = (event.target as HTMLSelectElement).value;
		await applySettingChange(setting, newValue);
		value = newValue;
	}
</script>

<div class="abt-setting" data-testid={ctx.key}>
	<span class="abt-setting__head">
		{#if icon}
			<span class="abt-setting__icon"><Icon name={icon} size={15} /></span>
		{/if}
		<span class="abt-setting__text">
			<span class="abt-setting__label">{labelText}</span>
			{#if setting.description}
				<span class="abt-setting__desc">{setting.description}</span>
			{/if}
		</span>
	</span>
	<select bind:value class="abt-input abt-setting__select" onchange={handleChange}>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>
