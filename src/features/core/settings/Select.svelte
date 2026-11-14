<script lang="ts">
	import { onMount } from "svelte";
	import type { SelectSetting } from "@features/types";
	import { applySettingChange } from "@features/runtime";
	import { getValue, watchValue } from "@lib/store";
	import Icon from "@lib/components/Icon.svelte";
	import PreviewToggle from "@lib/components/PreviewToggle.svelte";
	import ExperimentalMark from "@lib/components/ExperimentalMark.svelte";
	import WritesMark from "@lib/components/WritesMark.svelte";
	import type { IconName } from "@lib/icons";

	const { labelText, options, setting, icon } = $props<{
		labelText: string;
		options: { value: string; label: string; description?: string }[];
		setting: SelectSetting<any>;
		icon?: IconName;
	}>();
	const ctx = $derived(setting.context);

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

	// Matches the live sidebar's default, which `getValue` falls back to the same way.
	let liveSidebar = $state(true);
	$effect(() => {
		if (!setting.liveSidebarOnly) {
			return;
		}
		void getValue("experimental-sidebar", true).then((v) => (liveSidebar = v !== false));
		return watchValue("experimental-sidebar", (v) => (liveSidebar = v !== false));
	});

	async function pick(next: string) {
		await applySettingChange(setting, next);
		value = next;
	}

	const Picker = $derived(setting.picker);
	const description = $derived(
		options.find((o: { value: string }) => o.value === value)?.description ?? setting.description,
	);
</script>

<div
	class="abt-setting"
	class:abt-setting--stacked={Picker && !setting.pickerInline}
	class:abt-setting--wrap={Picker && setting.pickerInline}
	data-testid={ctx.key}
>
	<span class="abt-setting__head">
		{#if icon}
			<span class="abt-setting__icon"><Icon name={icon} size={15} /></span>
		{/if}
		<span class="abt-setting__text">
			<span class="abt-setting__label"
				>{labelText}{#if setting.experimental}<ExperimentalMark
					/>{/if}{#if setting.writes}<WritesMark writes={setting.writes} />{/if}</span
			>
			{#if description}
				<span class="abt-setting__desc">{description}</span>
			{/if}
			{#if setting.liveSidebarOnly && !liveSidebar}
				<span class="abt-setting__desc"
					>Live sidebar only: off while Actual's sidebar is in use.</span
				>
			{/if}
		</span>
	</span>
	{#if setting.preview}
		<PreviewToggle settingKey={ctx.key} />
	{/if}
	{#if Picker}
		<Picker {options} selected={value} onPick={pick} />
	{:else if setting.segmented}
		<div class="abt-seg abt-seg--sm" role="group" aria-label={labelText}>
			{#each options as option (option.value)}
				<button
					type="button"
					aria-pressed={value === option.value}
					onclick={() => pick(option.value)}>{option.label}</button
				>
			{/each}
		</div>
	{:else}
		<select
			bind:value
			class="abt-input abt-setting__select"
			onchange={(e) => pick(e.currentTarget.value)}
		>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{/if}
</div>
