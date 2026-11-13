<script lang="ts">
	import Switch from "@lib/components/Switch.svelte";

	const {
		label,
		checked,
		onCheckedChange,
		title,
		hint,
	}: {
		label: string;
		checked: boolean;
		onCheckedChange: (checked: boolean) => void;
		title?: string;
		/** A second line in the hover tip. */
		hint?: string;
	} = $props();
</script>

<label class="ft" {title} data-abt-tip-hint={hint}>
	<span>{label}</span>
	<Switch {checked} {onCheckedChange} />
</label>

<style>
	.ft {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-4);
		padding: var(--abt-space-3);
		border-radius: var(--abt-radius-sm);
		font-size: var(--abt-text-md);
		cursor: pointer;
	}

	.ft:hover {
		background: var(--abt-fill-hover);
	}
</style>
