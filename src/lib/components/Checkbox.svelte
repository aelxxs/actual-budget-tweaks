<script lang="ts">
	import { onMount } from "svelte";
	import type { CheckboxSetting } from "../../features/types";
	import { applySettingChange } from "../../features/runtime";
	import { getValue } from "../utilities/store";
	import Icon from "./Icon.svelte";
	import type { IconName } from "../icons";

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { labelText, setting, icon }: { labelText: string; setting: CheckboxSetting<any>; icon?: IconName } =
		$props();
	const ctx = setting.context;
	let value = $state(false);

	onMount(async () => {
		const saved = await getValue(ctx.key, ctx.defaultValue);
		value = Boolean(saved);
	});

	async function handleChange(event: Event) {
		const newValue = (event.target as HTMLInputElement).checked;
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
	<span class="switch">
		<input type="checkbox" class="switch__input" bind:checked={value} onchange={handleChange} />
		<span class="switch__track">
			<span class="switch__thumb"></span>
		</span>
	</span>
</label>

<style>
	.switch-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 8px;
		margin: 0 -8px;
		border-radius: 6px;
		border-top: 1px solid color-mix(in srgb, var(--color-pageText) 7%, transparent);
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.switch-row:first-child {
		border-top: none;
	}

	.switch-row:hover {
		background: color-mix(in srgb, var(--color-pageText) 5%, transparent);
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

	.switch {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
		width: 32px;
		height: 19px;
	}

	.switch__input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.switch__track {
		position: absolute;
		inset: 0;
		border-radius: 999px;
		background-color: var(--color-tableBackground);
		border: 1px solid var(--color-formInputBorder);
		transition:
			background-color 0.15s,
			border-color 0.15s;
	}

	.switch__thumb {
		position: absolute;
		top: 1px;
		left: 1px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--color-pageTextSubdued);
		transition:
			transform 0.15s,
			background-color 0.15s;
	}

	.switch__input:checked ~ .switch__track {
		background-color: var(--color-sidebarItemAccentSelected);
		border-color: var(--color-sidebarItemAccentSelected);
	}

	.switch__input:checked ~ .switch__track .switch__thumb {
		transform: translateX(13px);
		background: white;
	}

	.switch__input:focus-visible ~ .switch__track {
		outline: 2px solid var(--color-formInputBorderSelected);
		outline-offset: 2px;
	}
</style>
