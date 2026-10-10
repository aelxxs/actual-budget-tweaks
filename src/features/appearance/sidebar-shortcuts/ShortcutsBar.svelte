<script lang="ts">
	import { openSidebarSettings } from "@features/appearance/sidebar-settings-menu/settings";
	import { getValue, watchValue } from "@lib/utilities/store";
	import { mount, onMount, unmount } from "svelte";
	import { sidebarShortcutsAddTile } from ".";
	import Tiles from "./components/Tiles.svelte";
	import ToolPopover from "./components/ToolPopover.svelte";
	import { loadShortcuts, saveShortcuts, watchShortcuts } from "./store";
	import type { Shortcut, ToolId } from "./types";

	const { noPadding, budgetId }: { noPadding: boolean; budgetId: string | undefined } = $props();

	const ADD_TILE_KEY = sidebarShortcutsAddTile.context.key;

	let shortcuts = $state<Shortcut[]>([]);
	let showAddTile = $state(true);

	onMount(() => {
		getValue(ADD_TILE_KEY, true).then((v) => (showAddTile = Boolean(v)));
		return watchValue<boolean>(ADD_TILE_KEY, (v) => (showAddTile = v ?? true));
	});

	// Reloaded for each budget opened; none show until the budget is known.
	$effect(() => {
		const id = budgetId;
		shortcuts = [];
		if (!id) {
			return;
		}
		let current = true;
		loadShortcuts(id).then((stored) => {
			if (current) {
				shortcuts = stored;
			}
		});
		const stop = watchShortcuts(id, (stored) => (shortcuts = stored));
		return () => {
			current = false;
			stop();
		};
	});

	function save(items: Shortcut[]) {
		shortcuts = items;
		if (budgetId) {
			saveShortcuts(budgetId, items);
		}
	}

	let activePopover: { instance: any; container: HTMLElement } | null = null;

	function closePopover() {
		if (activePopover) {
			unmount(activePopover.instance);
			activePopover.container.remove();
			activePopover = null;
		}
	}

	function openTool(toolId: ToolId, label: string, anchorEl: HTMLElement) {
		closePopover();
		const rect = anchorEl.getBoundingClientRect();
		const container = document.createElement("div");
		container.dataset.abtModal = "tool-popover";
		document.body.appendChild(container);

		const instance = mount(ToolPopover, {
			target: container,
			props: {
				toolId,
				title: label,
				anchorX: rect.right + 8,
				anchorY: rect.top,
				onClose: () => {
					unmount(instance);
					container.remove();
					activePopover = null;
				},
			},
		});
		activePopover = { instance, container };
	}

	function handleClick(shortcut: Shortcut, el: HTMLElement) {
		if (shortcut.type === "tool") {
			openTool(shortcut.url as ToolId, shortcut.label, el);
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
		width: 38px;
		height: 38px;
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
