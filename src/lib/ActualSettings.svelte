<script lang="ts">
	import CheckboxOption from "./components/Checkbox.svelte";
	import SelectOption from "./components/Select.svelte";
	import { scripts } from "./scripts";
</script>

<div class="flow">
	<span><strong>Interface Settings</strong> — Configure Actual</span>

	{#each scripts as script (Array.isArray(script) ? script[0]?.context.key : script.context.key)}
		{#if Array.isArray(script)}
			<div class="cluster">
				{#each script as item (item.context.key)}
					{#if item.type === "select"}
						<SelectOption
							labelText={item.label}
							options={item.options}
							ctx={item.context}
							onChange={item.onChange}
						/>
					{:else if item.type === "checkbox"}
						<CheckboxOption labelText={item.label} ctx={item.context} onChange={item.onChange} />
					{/if}
				{/each}
			</div>
		{:else if script.type === "select"}
			<SelectOption
				labelText={script.label}
				options={script.options}
				ctx={script.context}
				onChange={script.onChange!}
			/>
		{:else if script.type === "checkbox"}
			<!-- TODO: Fix type error here -->
			<CheckboxOption labelText={script.label} ctx={script.context} onChange={script.onChange as any} />
		{/if}
	{/each}
</div>

<style>
	:global {
		.cluster {
			display: flex;
			flex-wrap: var(--wrap, wrap);
			justify-content: var(--justify, flex-start);
			align-items: var(--align, center);
			gap: var(--gutter, 1rem);
		}

		.stack {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
		}

		.stack > * {
			margin-block: 0;
		}

		.stack > * + * {
			margin-block-start: var(--space, 0.5rem);
		}

		.flow > * + * {
			margin-top: var(--flow-space, 1.5rem);
		}
	}
</style>
