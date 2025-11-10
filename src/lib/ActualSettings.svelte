<script lang="ts">
	import CheckboxOption from "./components/Checkbox.svelte";
	import SelectOption from "./components/Select.svelte";
	import { scripts } from "./scripts";
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
	<span><strong>Interface Settings</strong> — Configure Actual</span>

	{#each scripts as script (script.context.key)}
		{#if script.type === "select"}
			<SelectOption
				labelText={script.label}
				options={script.options}
				ctx={script.context}
				onChange={script.onChange!}
			/>
		{:else if script.type === "checkbox"}
			<CheckboxOption labelText={script.label} ctx={script.context} onChange={script.onChange!} />
		{/if}
	{/each}
</div>
