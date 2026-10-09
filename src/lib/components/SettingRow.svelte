<script lang="ts">
	import type { Setting } from "../../features/types";
	import CheckboxOption from "./Checkbox.svelte";
	import { previewState } from "./preview.svelte";
	import SelectOption from "./Select.svelte";

	/** One ABT setting, rendered the same wherever it's shown: settings page or dialogs. */
	const { setting, label }: { setting: Setting; label?: string } = $props();

	const Preview = $derived(
		setting.type === "checkbox" || setting.type === "select" ? setting.preview : undefined,
	);
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
		<div class="abt-setting abt-setting--stacked" data-testid={setting.context.key}>
			{#if label ?? setting.label}
				<span class="abt-setting__text">
					<span class="abt-setting__label">{label ?? setting.label}</span>
					{#if setting.description}
						<span class="abt-setting__desc">{setting.description}</span>
					{/if}
				</span>
			{/if}
			<C ctx={setting.context} />
		</div>
	{/if}
{:else if setting.type === "checkbox"}
	<CheckboxOption labelText={label ?? setting.label} {setting} icon={setting.icon} />
{/if}

{#if Preview && setting.type !== "core" && previewState.open === setting.context.key}
	<div class="abt-setting-preview">
		<Preview />
	</div>
{/if}
