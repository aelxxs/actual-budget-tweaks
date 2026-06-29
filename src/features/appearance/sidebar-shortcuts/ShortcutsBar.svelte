<script lang="ts">
	import { getValue, setValue } from "@lib/utilities/store";
	import { mount, unmount } from "svelte";
	import InlineWidget from "./components/InlineWidget.svelte";
	import ShortcutsModal from "./components/Modal.svelte";
	import ToolPopover from "./components/ToolPopover.svelte";
	import { getFaviconUrl } from "@lib/utilities/favicon";
	import type { BuiltinTool, BuiltinWidget, Shortcut, ToolId, WidgetId } from "./types";

	const STORAGE_KEY = "abt-sidebar-shortcuts";
	const COLORS = [
		[139, 92, 246],
		[59, 130, 246],
		[16, 185, 129],
		[245, 158, 11],
		[239, 68, 68],
		[236, 72, 153],
		[14, 165, 233],
		[168, 85, 247],
	];

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

	const SVG_ICONS: Record<string, string> = {
		"svg:calc": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`,
		"svg:convert": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
		"svg:stock": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
		"svg:interest": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
		"svg:calendar": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
		"svg:rsu": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/><circle cx="12" cy="14" r="2"/><path d="M12 16v2"/></svg>`,
	};

	let shortcuts = $state<Shortcut[]>([]);
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

	function getColor(idx: number) {
		const [r, g, b] = COLORS[idx % COLORS.length];
		return {
			bg: `rgba(${r}, ${g}, ${b}, 0.18)`,
			hover: `rgba(${r}, ${g}, ${b}, 0.3)`,
			shadow: `rgba(${r}, ${g}, ${b}, 0.18)`,
		};
	}

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

	function handleClick(shortcut: Shortcut, e: MouseEvent) {
		if (shortcut.type === "tool") {
			openTool(shortcut.url as ToolId, shortcut.label, e.currentTarget as HTMLElement);
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
				onSave: async (items: Shortcut[]) => {
					await save(items);
					cleanup();
				},
				onClose: cleanup,
			},
		});
		document.body.appendChild(container);
	}

	function onFaviconError(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		const parent = img.parentElement;
		if (parent) {
			img.remove();
			parent.textContent = "🔗";
		}
	}

	let dragIdx = $state<number | null>(null);
	let dropTarget = $state<{ idx: number; side: "before" | "after" } | null>(null);
	let barEl: HTMLDivElement | undefined = $state();

	function onDragStart(idx: number, e: DragEvent) {
		dragIdx = idx;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", String(idx));
		}
	}

	function onBarDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		if (dragIdx == null || !barEl) return;

		const items = barEl.querySelectorAll<HTMLElement>(".item");
		let closest: { idx: number; side: "before" | "after"; dist: number } | null = null as { idx: number; side: "before" | "after"; dist: number } | null;

		items.forEach((el, idx) => {
			if (idx === dragIdx) return;
			const rect = el.getBoundingClientRect();
			const shortcut = shortcuts[idx];
			const isWide = shortcut.size === "wide";

			let side: "before" | "after";
			let dist: number;

			if (isWide) {
				const midY = rect.top + rect.height / 2;
				side = e.clientY < midY ? "before" : "after";
				dist = Math.abs(e.clientY - midY);
			} else {
				const midX = rect.left + rect.width / 2;
				side = e.clientX < midX ? "before" : "after";
				dist = Math.abs(e.clientX - midX);
			}

			if (!closest || dist < closest.dist) {
				closest = { idx, side, dist };
			}
		});

		dropTarget = closest ? { idx: closest.idx, side: closest.side } : null;
	}

	function onBarDrop(e: DragEvent) {
		e.preventDefault();
		if (dragIdx != null && dropTarget) {
			const a = [...shortcuts];
			const [moved] = a.splice(dragIdx, 1);
			let insertAt = dropTarget.idx;
			if (dragIdx < insertAt) insertAt--;
			if (dropTarget.side === "after") insertAt++;
			a.splice(insertAt, 0, moved);
			save(a);
		}
		dragIdx = null;
		dropTarget = null;
	}

	function onDragEnd() {
		dragIdx = null;
		dropTarget = null;
	}
</script>

<div class="bar" role="list" bind:this={barEl} ondragover={onBarDragOver} ondrop={onBarDrop}>
	{#each shortcuts as shortcut, idx (shortcut.id)}
		{@const color = getColor(idx)}

		{@const isDataWidget = shortcut.url === "upcoming-schedules"}
		{#if shortcut.type === "widget"}
			<div
				class="item"
				class:is-small={shortcut.size === "small"}
				class:is-half={shortcut.size === "half"}
				class:is-wide={shortcut.size === "wide"}
				class:is-data={isDataWidget}
				class:is-dragging={dragIdx === idx}
				class:is-drop-before={dropTarget?.idx === idx && dropTarget?.side === "before"}
				class:is-drop-after={dropTarget?.idx === idx && dropTarget?.side === "after"}
				role="listitem"
				style="--sc-bg: {color.bg}; --sc-bg-hover: {isDataWidget ? color.hover : color.bg}; --sc-shadow: {color.shadow}; cursor: {isDataWidget ? 'pointer' : 'default'}"
				title={shortcut.label}
				draggable="true"
				ondragstart={(e) => onDragStart(idx, e)}
				ondragend={onDragEnd}
			>
				<InlineWidget widgetId={shortcut.url as WidgetId} config={shortcut.config} />
			</div>
		{:else}
			<button
				class="item"
				class:is-small={shortcut.size === "small"}
				class:is-half={shortcut.size === "half"}
				class:is-wide={shortcut.size === "wide"}
				class:is-dragging={dragIdx === idx}
				class:is-drop-before={dropTarget?.idx === idx && dropTarget?.side === "before"}
				class:is-drop-after={dropTarget?.idx === idx && dropTarget?.side === "after"}
				style="--sc-bg: {color.bg}; --sc-bg-hover: {color.hover}; --sc-shadow: {color.shadow}"
				title={shortcut.label}
				onclick={(e) => handleClick(shortcut, e)}
				draggable="true"
				ondragstart={(e) => onDragStart(idx, e)}
				ondragend={onDragEnd}
			>
				{#if shortcut.icon && SVG_ICONS[shortcut.icon]}
					{@html SVG_ICONS[shortcut.icon]}
				{:else if shortcut.type === "external" && !shortcut.icon}
					{@const fav = getFaviconUrl(shortcut.url)}
					{#if fav}
						<img src={fav} alt="" width="20" height="20" class="favicon" onerror={onFaviconError} />
					{:else}
						🔗
					{/if}
				{:else}
					{shortcut.icon || "🔗"}
				{/if}
			</button>
		{/if}
	{/each}

	<button class="edit-btn" class:is-empty={shortcuts.length === 0} onclick={openModal} title="Edit shortcuts">
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg
		>
	</button>
</div>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 4px 12px 2px;
		flex-shrink: 0;
		align-items: center;
	}

	.item {
		height: 38px;
		border: none;
		border-radius: 10px;
		background: var(--sc-bg);
		color: var(--color-sidebarItemText, #e0e0e0);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		overflow: hidden;
		min-width: 0;
		transition:
			background 0.12s,
			transform 0.12s,
			box-shadow 0.12s;
	}

	.item:hover {
		background: var(--sc-bg-hover);
		transform: scale(1.05);
		box-shadow: 0 2px 8px var(--sc-shadow);
	}

	.item.is-small {
		width: 38px;
		flex: 0 0 38px;
		font-size: 17px;
	}

	.item.is-half {
		flex: 1 1 calc(50% - 3px);
		font-size: 12px;
		justify-content: flex-start;
	}

	.item.is-wide {
		flex: 1 1 100%;
		font-size: 12px;
		justify-content: flex-start;
	}

	.item.is-dragging {
		opacity: 0.3;
	}

	.item.is-drop-before,
	.item.is-drop-after {
		position: relative;
		overflow: visible !important;
	}

	/* Small items: vertical line left/right */
	.item.is-small.is-drop-before::before,
	.item.is-small.is-drop-after::after {
		content: "";
		position: absolute;
		top: 4px;
		bottom: 4px;
		width: 2px;
		background: var(--color-sidebarItemAccentSelected);
		border-radius: 1px;
	}

	.item.is-small.is-drop-before::before {
		left: -4px;
	}

	.item.is-small.is-drop-after::after {
		right: -4px;
	}

	/* Half items: vertical line left/right */
	.item.is-half.is-drop-before::before,
	.item.is-half.is-drop-after::after {
		content: "";
		position: absolute;
		top: 4px;
		bottom: 4px;
		width: 2px;
		background: var(--color-sidebarItemAccentSelected);
		border-radius: 1px;
	}

	.item.is-half.is-drop-before::before {
		left: -4px;
	}

	.item.is-half.is-drop-after::after {
		right: -4px;
	}

	/* Wide/data items: horizontal line top/bottom */
	.item.is-wide.is-drop-before::before,
	.item.is-wide.is-drop-after::after,
	.item.is-data.is-drop-before::before,
	.item.is-data.is-drop-after::after {
		content: "";
		position: absolute;
		left: 4px;
		right: 4px;
		height: 2px;
		background: var(--color-sidebarItemAccentSelected);
		border-radius: 1px;
	}

	.item.is-wide.is-drop-before::before,
	.item.is-data.is-drop-before::before {
		top: -4px;
	}

	.item.is-wide.is-drop-after::after,
	.item.is-data.is-drop-after::after {
		bottom: -4px;
	}

	.item.is-data {
		height: auto;
		min-height: 38px;
	}


	.favicon {
		border-radius: 4px;
		object-fit: contain;
		display: block;
	}

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
