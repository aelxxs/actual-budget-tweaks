<script lang="ts">
	import { onMount } from "svelte";
	import type { CheckboxSetting } from "../../features/types";
	import { applySettingChange } from "../../features/runtime";
	import { getValue, watchValue } from "../utilities/store";
	import Icon from "./Icon.svelte";
	import Switch from "./Switch.svelte";
	import type { IconName } from "../icons";

	const {
		labelText,
		setting,
		icon,
	}: { labelText: string; setting: CheckboxSetting<any>; icon?: IconName } = $props();
	const ctx = setting.context;
	let value = $state(false);

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

<label class="switch-row" data-testid={ctx.key}>
	{#if icon}
		<span class="switch-row__icon"><Icon name={icon} size={15} /></span>
	{/if}
	<span class="switch-row__text">
		<span class="switch-row__label">{labelText}</span>
		{#if setting.description}
			<span class="switch-row__desc">{setting.description}</span>
		{/if}
	</span>
	<Switch checked={value} onCheckedChange={handleChange} />
</label>

<style>
	.switch-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 8px;
		margin: 0 -8px;
		border-radius: var(--abt-radius-sm);
		border-top: 1px solid var(--abt-ink-2);
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.switch-row:first-child {
		border-top: none;
	}

	.switch-row:hover {
		background: var(--abt-ink-1);
	}

	.switch-row__icon {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--color-pageTextSubdued);
	}

	.switch-row__text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.switch-row__label {
		font-size: 13px;
		font-weight: 500;
	}

	.switch-row__desc {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
	}
</style>
