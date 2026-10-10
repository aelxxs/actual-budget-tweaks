<script lang="ts">
	import { onMount } from "svelte";
	import type { CheckboxSetting } from "../../features/types";
	import { applySettingChange } from "../../features/runtime";
	import { getValue, watchValue } from "../utilities/store";
	import Icon from "./Icon.svelte";
	import PreviewToggle from "./PreviewToggle.svelte";
	import Switch from "./Switch.svelte";
	import WritesMark from "./WritesMark.svelte";
	import type { IconName } from "../icons";

	const {
		labelText,
		setting,
		icon,
	}: { labelText: string; setting: CheckboxSetting<any>; icon?: IconName } = $props();
	const ctx = setting.context;
	let value = $state(false);
	// The row's label points at the switch, not the first control inside it (the preview button).
	const switchId = $props.id();

	onMount(async () => {
		const saved = await getValue(ctx.key, ctx.defaultValue);
		value = Boolean(saved);
	});

	// Follows changes made elsewhere, like a sync from another browser.
	$effect(() => watchValue(ctx.key, (v) => (value = Boolean(v ?? ctx.defaultValue))));

	async function handleChange(newValue: boolean) {
		await applySettingChange(setting, newValue);
		value = newValue;
	}
</script>

<label class="abt-setting switch-row" for={switchId} data-testid={ctx.key}>
	{#if icon}
		<span class="abt-setting__icon"><Icon name={icon} size={15} /></span>
	{/if}
	<span class="abt-setting__text">
		<span class="abt-setting__label"
			>{labelText}{#if setting.writes}<WritesMark writes={setting.writes} />{/if}</span
		>
		{#if setting.description}
			<span class="abt-setting__desc">{setting.description}</span>
		{/if}
	</span>
	{#if setting.preview}
		<PreviewToggle settingKey={ctx.key} />
	{/if}
	<Switch id={switchId} checked={value} onCheckedChange={handleChange} />
</label>

<style>
	.switch-row {
		cursor: pointer;
	}

	.switch-row:hover {
		background: var(--abt-ink-1);
	}
</style>
