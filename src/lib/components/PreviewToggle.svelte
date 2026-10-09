<script lang="ts">
	import { Eye } from "lucide-svelte";
	import { previewState } from "./preview.svelte";

	const { settingKey }: { settingKey: string } = $props();
	const open = $derived(previewState.open === settingKey);
</script>

<!-- Inside the switch row's label: preventDefault keeps the click from toggling the setting. -->
<button
	type="button"
	class="abt-btn abt-btn--icon abt-btn--sm abt-btn--ghost preview-toggle"
	class:open
	aria-label="Preview"
	aria-expanded={open}
	title="Preview"
	onclick={(e) => {
		e.preventDefault();
		e.stopPropagation();
		previewState.open = open ? null : settingKey;
	}}
>
	<Eye size={15} strokeWidth={1.75} />
</button>

<style>
	.preview-toggle.open {
		--abt-btn-fg: var(--abt-accent);
		--abt-btn-bg: var(--abt-accent-2);
	}
</style>
