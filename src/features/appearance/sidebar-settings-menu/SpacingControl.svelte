<script lang="ts">
	import { sidebarAccountSpacing } from "@features/layout/sidebar-account-spacing";
	import SpacingPicker from "@features/layout/sidebar-account-spacing/Picker.svelte";
</script>

<div class="spacing" data-testid={sidebarAccountSpacing.context.key}>
	<span class="spacing__label">{sidebarAccountSpacing.label}</span>
	<SpacingPicker ctx={sidebarAccountSpacing.context} />
</div>

<style>
	.spacing {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.spacing__label {
		font-size: 12px;
	}
</style>
