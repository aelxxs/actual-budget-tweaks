<script lang="ts">
	import { getValue, setValue } from "@lib/utilities/store";
	import { mount, unmount } from "svelte";
	import ShortcutsModal from "./components/Modal.svelte";
	import Tiles from "./components/Tiles.svelte";
	import ToolPopover from "./components/ToolPopover.svelte";
	import type { BuiltinTool, BuiltinWidget, Shortcut, ToolId } from "./types";

	const { noPadding }: { noPadding: boolean } = $props();

	const STORAGE_KEY = "abt-sidebar-shortcuts";
	const BUILTIN_TOOLS: BuiltinTool[] = [
		{ id: "calculator", label: "Calculator", icon: "svg:calc" },
		{ id: "currency-converter", label: "Currency Converter", icon: "svg:convert" },
		{ id: "interest-calculator", label: "Interest Calculator", icon: "svg:interest" },
	];

	const BUILTIN_WIDGETS: BuiltinWidget[] = [
		{ id: "stock-tracker", label: "Stock Tracker", icon: "svg:stock" },
		{ id: "upcoming-schedules", label: "Upcoming Bills", icon: "svg:calendar" },
		{ id: "rsu-tracker", label: "RSU Tracker", icon: "svg:rsu" },
	];

	let shortcuts = $state<Shortcut[]>([]);
	let barWidth = $state(0);
	let activePopover: { instance: any; container: HTMLElement } | null = null;

	async function load() {
		shortcuts = (await getValue<Shortcut[]>(STORAGE_KEY, [])) ?? [];
	}

	async function save(items: Shortcut[]) {
		const plain = JSON.parse(JSON.stringify(items)) as Shortcut[];
		shortcuts = plain;
		await setValue(STORAGE_KEY, plain);
	}

	load();

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

	function openModal() {
		document.querySelectorAll("[data-abt-modal='shortcuts']").forEach((el) => el.remove());

		const container = document.createElement("div");
		container.dataset.abtModal = "shortcuts";
		let done = false;

		const cleanup = () => {
			if (done) return;
			done = true;
			unmount(instance);
			container.remove();
		};

		const instance = mount(ShortcutsModal, {
			target: container,
			props: {
				shortcuts: [...shortcuts],
				builtinTools: BUILTIN_TOOLS,
				builtinWidgets: BUILTIN_WIDGETS,
				previewWidth: barWidth - (noPadding ? 0 : 24),
				onSave: async (items: Shortcut[]) => {
					await save(items);
					cleanup();
				},
				onClose: cleanup,
			},
		});
		document.body.appendChild(container);
	}
</script>

<div bind:clientWidth={barWidth}>
	<Tiles
		items={shortcuts}
		mode="bar"
		padding={noPadding ? "0px" : "4px 12px 2px"}
		onReorder={save}
		onActivate={handleClick}
	>
		{#snippet trailing()}
			<button
				class="edit-btn"
				class:is-empty={shortcuts.length === 0}
				onclick={openModal}
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
		{/snippet}
	</Tiles>
</div>

<style>
	.edit-btn {
		width: 38px;
		height: 38px;
		border: 1.5px dashed color-mix(in srgb, var(--color-sidebarItemText) 30%, transparent);
		border-radius: 10px;
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
