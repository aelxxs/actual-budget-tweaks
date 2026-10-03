<script lang="ts">
	import { budgetTableRowHeight } from "@features/layout/budget-table-row-height";
	import { ROW_HEIGHT_OPTIONS } from "@features/layout/budget-table-row-height/options";
	import { categoryProgress } from "@features/readability/category-progress";
	import { applySettingChange } from "@features/runtime";
	import type { CheckboxSetting } from "@features/types";
	import { categoryTemplateInsights } from "@features/workflows/category-template-insights";
	import Switch from "@lib/components/Switch.svelte";
	import { applyGlobalCSS } from "@lib/utilities/dom";
	import { getValue, setValue } from "@lib/utilities/store";
	import { onMount } from "svelte";

	// Shortcuts to the real settings: same storage keys and lifecycle as the settings page.
	const toggles: { setting: CheckboxSetting<any>; label: string }[] = [
		{ setting: categoryTemplateInsights, label: "Template insight bars" },
		{ setting: categoryProgress, label: "Progress rings" },
	];

	const rowHeightCtx = budgetTableRowHeight.context;

	let values = $state<Record<string, boolean>>({});
	let rowHeight = $state(rowHeightCtx.defaultValue);

	onMount(async () => {
		const entries = await Promise.all(
			toggles.map(async ({ setting }) => {
				const { key, defaultValue } = setting.context;
				return [key, Boolean(await getValue(key, defaultValue))] as const;
			}),
		);
		values = Object.fromEntries(entries);
		rowHeight = (await getValue(rowHeightCtx.key, rowHeightCtx.defaultValue)) as string;
	});

	async function toggle(setting: CheckboxSetting<any>, checked: boolean) {
		values[setting.context.key] = checked;
		await applySettingChange(setting, checked);
	}

	async function pickRowHeight(value: string) {
		rowHeight = value;
		await setValue(rowHeightCtx.key, value);
		applyGlobalCSS(rowHeightCtx.css(value), rowHeightCtx.key);
	}
</script>

<div class="vo">
	<div class="vo__label">Show</div>
	{#each toggles as { setting, label } (setting.context.key)}
		<label class="vo__row">
			<span>{label}</span>
			<Switch
				checked={values[setting.context.key] ?? false}
				onCheckedChange={(checked) => toggle(setting, checked)}
			/>
		</label>
	{/each}

	<div class="vo__label">Row height</div>
	<div class="vo__segments" role="radiogroup" aria-label="Row height">
		{#each ROW_HEIGHT_OPTIONS as opt (opt.value)}
			<button
				type="button"
				class="vo__segment"
				class:is-active={rowHeight === opt.value}
				role="radio"
				aria-checked={rowHeight === opt.value}
				onclick={() => pickRowHeight(opt.value)}
			>
				{opt.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.vo {
		width: 240px;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		border-radius: var(--abt-radius);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		font-size: 12px;
	}

	.vo__label {
		padding: 6px 6px 4px;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-pageTextSubdued);
	}
	.vo__label:not(:first-child) {
		margin-top: 6px;
	}

	.vo__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px;
		border-radius: var(--abt-radius-sm);
		cursor: pointer;
	}
	.vo__row:hover {
		background: var(--color-menuItemBackgroundHover);
		color: var(--color-menuItemTextHover);
	}

	.vo__segments {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 2px;
		padding: 2px;
		margin: 0 6px 4px;
		border-radius: var(--abt-radius-sm);
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
	}

	.vo__segment {
		padding: 4px 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 11px;
		cursor: pointer;
	}
	.vo__segment:hover:not(.is-active) {
		background: color-mix(in srgb, var(--color-pageText) 8%, transparent);
	}
	.vo__segment.is-active {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 600;
	}
</style>
