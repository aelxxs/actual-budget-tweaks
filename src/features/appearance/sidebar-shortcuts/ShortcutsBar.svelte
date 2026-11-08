<script lang="ts">
	import { openSidebarSettings } from "@features/appearance/sidebar-settings-menu/settings";
	import { getValue, watchValue } from "@lib/utilities/store";
	import { lastShown, rememberShown } from "@lib/utilities/last-shown";
	import { onMount } from "svelte";
	import { sidebarShortcutsAddTile } from ".";
	import Tiles from "./components/Tiles.svelte";
	import { closeTool, isToolOpen, openTool } from "./open-tool";
	import { loadShortcuts, saveShortcuts, watchShortcuts } from "./store";
	import type { Shortcut, ToolId } from "./types";

	const { noPadding, budgetId }: { noPadding: boolean; budgetId: string | undefined } = $props();

	const ADD_TILE_KEY = sidebarShortcutsAddTile.context.key;

	// The last load's tiles show until this budget's arrive, so the accounts below don't shift.
	let shortcuts = $state<Shortcut[]>(lastShown("sidebar-shortcuts", []));
	let showAddTile = $state(true);

	onMount(() => {
		getValue(ADD_TILE_KEY, true).then((v) => (showAddTile = Boolean(v)));
		return watchValue<boolean>(ADD_TILE_KEY, (v) => (showAddTile = v ?? true));
	});

	// Reloaded for each budget opened.
	$effect(() => {
		const id = budgetId;
		if (!id) {
			return;
		}
		let current = true;
		const show = (stored: Shortcut[]) => {
			shortcuts = stored;
			rememberShown("sidebar-shortcuts", stored);
		};
		loadShortcuts(id).then((stored) => {
			if (current) {
				show(stored);
			}
		});
		const stop = watchShortcuts(id, show);
		return () => {
			current = false;
			stop();
		};
	});

	function save(items: Shortcut[]) {
		shortcuts = items;
		rememberShown("sidebar-shortcuts", items);
		if (budgetId) {
			saveShortcuts(budgetId, items);
		}
	}

	function handleClick(shortcut: Shortcut, el: HTMLElement) {
		if (shortcut.type === "tool") {
			const toolId = shortcut.url as ToolId;
			if (isToolOpen(toolId)) {
				closeTool();
			} else {
				const rect = el.getBoundingClientRect();
				void openTool(toolId, shortcut.label, rect.right + 8, rect.top);
			}
		} else if (shortcut.type === "external") {
			window.open(shortcut.url, "_blank", "noopener");
		}
	}
</script>

<div data-abt-shortcuts-tiles>
	<Tiles
		items={shortcuts}
		mode="bar"
		padding={noPadding ? "0px" : "4px 12px 2px"}
		onReorder={save}
		onActivate={handleClick}
		hasTrailing={showAddTile || shortcuts.length === 0}
	>
		{#snippet trailing()}
			{#if showAddTile || shortcuts.length === 0}
				<button
					class="edit-btn"
					class:is-empty={shortcuts.length === 0}
					onclick={() => openSidebarSettings({ tab: "shortcuts" })}
					title="Edit shortcuts"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg
					>
				</button>
			{/if}
		{/snippet}
	</Tiles>
</div>

<style>
	.edit-btn {
		width: 36px;
		height: 36px;
		border: 1.5px dashed color-mix(in srgb, var(--color-sidebarItemText) 30%, transparent);
		border-radius: 10px; /* raw: fixed, with the sidebar search bar */
		background: color-mix(in srgb, var(--color-sidebarItemText) 5%, transparent);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-sidebarItemText);
		opacity: 0.45;
		transition:
			opacity 0.1s,
			border-color 0.1s,
			background 0.1s;
		padding: 0;
		flex-shrink: 0;
		line-height: 1;
	}

	.edit-btn.is-empty {
		opacity: 0.6;
	}

	.edit-btn:hover {
		opacity: 0.8;
		border-color: color-mix(in srgb, var(--color-sidebarItemText) 45%, transparent);
		background: color-mix(in srgb, var(--color-sidebarItemText) 10%, transparent);
	}
</style>
