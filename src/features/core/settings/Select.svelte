<script lang="ts">
	import type { SelectSetting } from "@features/types";
	import { applySettingChange } from "@features/runtime";
	import { storedValue } from "@lib/stored.svelte";
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

	const stored = storedValue<unknown>(() => setting.context);
	const value = $derived(typeof stored.current === "string" ? stored.current : "");

	// Matches the live sidebar's default, which `getValue` falls back to the same way.
	const sidebar = storedValue<unknown>("experimental-sidebar", true);
	const liveSidebar = $derived(sidebar.current !== false);

	const pick = (next: string) => applySettingChange(setting, next);

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
			{value}
			class="abt-input abt-setting__select"
			onchange={(e) => pick(e.currentTarget.value)}
		>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{/if}
</div>
