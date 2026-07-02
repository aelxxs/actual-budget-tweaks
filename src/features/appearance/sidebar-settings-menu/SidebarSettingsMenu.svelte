<script lang="ts">
	import CheckboxOption from "@lib/components/Checkbox.svelte";
	import { accountIconPicker } from "@features/appearance/account-icon-picker";
	import { sidebarIcons } from "@features/appearance/sidebar-icons";
	import { sidebarRedesign } from "@features/appearance/sidebar-redesign";
	import { sidebarSearch } from "@features/appearance/sidebar-search";
	import { sidebarShortcuts } from "@features/appearance/sidebar-shortcuts";
	import SpacingControl from "./SpacingControl.svelte";
</script>

<div class="menu">
	<div class="menu__title">Sidebar Settings</div>
	<div class="menu__row">
		<SpacingControl />
	</div>

	<div class="menu__divider"></div>

	<div class="menu__row">
		<CheckboxOption labelText={sidebarRedesign.label} setting={sidebarRedesign} icon="layout" />
	</div>
	<div class="menu__row">
		<CheckboxOption labelText={sidebarIcons.label} setting={sidebarIcons} icon="shuffle" />
	</div>
	<div class="menu__row">
		<CheckboxOption labelText={sidebarSearch.label} setting={sidebarSearch} icon="search" />
	</div>
	<div class="menu__row">
		<CheckboxOption labelText={sidebarShortcuts.label} setting={sidebarShortcuts} icon="star" />
	</div>
	<div class="menu__row">
		<CheckboxOption labelText={accountIconPicker.label} setting={accountIconPicker} icon="image" />
	</div>
</div>

<style>
	.menu {
		min-width: 240px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.menu__title {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--color-pageTextSubdued);
		margin-bottom: 2px;
	}

	.menu__row {
		font-size: 12px;
	}

	.menu__divider {
		height: 1px;
		margin: 2px 0;
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}
</style>
