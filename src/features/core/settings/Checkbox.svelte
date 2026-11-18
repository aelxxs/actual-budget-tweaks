<script lang="ts">
	import type { CheckboxSetting } from "@features/types";
	import { applySettingChange } from "@features/runtime";
	import { isTrackingBudget, onBudgetType } from "@lib/actual/budget-type";
	import { storedValue } from "@lib/stored.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import PreviewToggle from "@lib/components/PreviewToggle.svelte";
	import Switch from "@lib/components/Switch.svelte";
	import ExperimentalMark from "@lib/components/ExperimentalMark.svelte";
	import WritesMark from "@lib/components/WritesMark.svelte";
	import type { IconName } from "@lib/icons";

	const SITE_URL = "https://abt.alexis.lol";

	const {
		labelText,
		setting,
		icon,
	}: { labelText: string; setting: CheckboxSetting<any>; icon?: IconName } = $props();
	const ctx = $derived(setting.context);
	const stored = storedValue<unknown>(() => setting.context);
	const value = $derived(Boolean(stored.current));
	// The row's label points at the switch, not the first control inside it (the preview button).
	const switchId = $props.id();

	let tracking = $state(isTrackingBudget());
	$effect(() => onBudgetType((type) => (tracking = type === "tracking")));
	const standsDown = $derived(!!setting.envelopeOnly && tracking);

	const handleChange = (newValue: boolean) => applySettingChange(setting, newValue);
</script>

<label class="abt-setting switch-row" for={switchId} data-testid={ctx.key}>
	{#if icon}
		<span class="abt-setting__icon"><Icon name={icon} size={15} /></span>
	{/if}
	<span class="abt-setting__text">
		<span class="abt-setting__label"
			>{labelText}{#if setting.experimental}<ExperimentalMark />{/if}{#if setting.writes}<WritesMark
					writes={setting.writes}
				/>{/if}</span
		>
		{#if setting.description}
			<span class="abt-setting__desc">{setting.description}</span>
		{/if}
		{#if standsDown}
			<span class="abt-setting__desc"
				>Envelope budgets only: off while this budget uses tracking.</span
			>
		{/if}
	</span>
	{#if setting.guide}
		<a
			class="guide"
			href={`${SITE_URL}${setting.guide}`}
			target="_blank"
			rel="noreferrer"
			onclick={(e) => e.stopPropagation()}>Guide</a
		>
	{/if}
	{#if setting.preview}
		<PreviewToggle settingKey={ctx.key} />
	{/if}
	<Switch id={switchId} checked={value} onCheckedChange={handleChange} />
</label>

<style>
	.switch-row {
		cursor: pointer;
	}

	.guide {
		flex-shrink: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-accent-text);
		text-decoration: none;
	}

	.guide:hover {
		text-decoration: underline;
	}

	.switch-row:hover {
		background: var(--abt-ink-1);
	}
</style>
