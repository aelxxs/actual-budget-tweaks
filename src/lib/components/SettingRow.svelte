<script lang="ts">
	import type { Setting } from "../../features/types";
	import CheckboxOption from "./Checkbox.svelte";
	import SelectOption from "./Select.svelte";

	/** One ABT setting, rendered the same wherever it's shown: settings page or dialogs. */
	const { setting, label }: { setting: Setting; label?: string } = $props();
</script>

{#if setting.type === "select"}
	<SelectOption
		labelText={label ?? setting.label}
		options={setting.options}
		{setting}
		icon={setting.icon}
	/>
{:else if setting.type === "custom"}
	{#if setting.component}
		{@const C = setting.component}
		<div class="custom-setting" data-testid={setting.context.key}>
			{#if label ?? setting.label}
				<span class="custom-setting__text">
					<span class="custom-setting__label">{label ?? setting.label}</span>
					{#if setting.description}
						<span class="custom-setting__desc">{setting.description}</span>
					{/if}
				</span>
			{/if}
			<C ctx={setting.context} />
		</div>
	{/if}
{:else if setting.type === "checkbox"}
	<CheckboxOption labelText={label ?? setting.label} {setting} icon={setting.icon} />
{/if}

<style>
	.custom-setting {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 8px;
		margin: 0 -8px;
		border-radius: var(--abt-radius);
		border-top: 1px solid var(--abt-ink-2);
	}

	.custom-setting:first-child {
		border-top: none;
	}

	.custom-setting__text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.custom-setting__label {
		font-size: 13px;
		font-weight: 500;
	}

	.custom-setting__desc {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
	}
</style>
