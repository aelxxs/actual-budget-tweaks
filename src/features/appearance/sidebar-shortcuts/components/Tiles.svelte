<script lang="ts">
	import { icon } from "@lib/icons";
	import { getFaviconUrl } from "@lib/utilities/favicon";
	import { X } from "lucide-svelte";
	import type { Snippet } from "svelte";
	import { flip } from "svelte/animate";
	import { scale } from "svelte/transition";
	import type { Shortcut, WidgetId } from "../types";
	import InlineWidget from "./InlineWidget.svelte";

	type TilesProps = {
		items: Shortcut[];
		/** "bar" opens shortcuts on click; "edit" makes them removable and keyboard-movable. */
		mode: "bar" | "edit";
		padding?: string;
		/** A not-yet-added shortcut, drawn translucent after the others. */
		ghost?: Shortcut | null;
		onReorder: (items: Shortcut[]) => void;
		onRemove?: (id: string) => void;
		onActivate?: (shortcut: Shortcut, el: HTMLElement) => void;
		trailing?: Snippet;
	};

	const {
		items,
		mode,
		padding = "0",
		ghost = null,
		onReorder,
		onRemove,
		onActivate,
		trailing,
	}: TilesProps = $props();

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

	const SVG_ICONS: Record<string, string> = {
		"svg:calc": icon("calculator", { size: 18 }),
		"svg:convert": icon("currencyConvert", { size: 18 }),
		"svg:stock": icon("stock", { size: 18 }),
		"svg:interest": icon("interest", { size: 18 }),
		"svg:calendar": icon("calendar", { size: 18 }),
		"svg:rsu": icon("rsu", { size: 18 }),
	};

	function colorVars(idx: number, hoverable: boolean): string {
		const [r, g, b] = COLORS[idx % COLORS.length];
		const bg = `rgba(${r}, ${g}, ${b}, 0.18)`;
		const hover = hoverable ? `rgba(${r}, ${g}, ${b}, 0.3)` : bg;
		return `--sc-bg: ${bg}; --sc-bg-hover: ${hover}; --sc-shadow: rgba(${r}, ${g}, ${b}, 0.18)`;
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

	// Full-width tiles split top/bottom; the rest split left/right, nearest tile wins.
	function onBarDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		if (dragIdx == null || !barEl) return;

		let closest: { idx: number; side: "before" | "after"; dist: number } | null = null;
		const tiles = barEl.querySelectorAll<HTMLElement>(":scope > .item:not(.is-ghost)");
		for (const [idx, el] of tiles.entries()) {
			if (idx === dragIdx) continue;
			const rect = el.getBoundingClientRect();
			const vertical = items[idx]?.size === "wide";
			const mid = vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
			const pos = vertical ? e.clientY : e.clientX;
			const dist = Math.abs(pos - mid);
			if (!closest || dist < closest.dist) {
				closest = { idx, side: pos < mid ? "before" : "after", dist };
			}
		}
		dropTarget = closest ? { idx: closest.idx, side: closest.side } : null;
	}

	function move(from: number, to: number) {
		const a = [...items];
		const [moved] = a.splice(from, 1);
		a.splice(to, 0, moved);
		onReorder(a);
	}

	function onBarDrop(e: DragEvent) {
		e.preventDefault();
		if (dragIdx != null && dropTarget) {
			let insertAt = dropTarget.idx;
			if (dragIdx < insertAt) insertAt--;
			if (dropTarget.side === "after") insertAt++;
			move(dragIdx, insertAt);
		}
		onDragEnd();
	}

	function onDragEnd() {
		dragIdx = null;
		dropTarget = null;
	}

	function onEditKey(idx: number, e: KeyboardEvent) {
		if (e.key === "Delete" || e.key === "Backspace") {
			e.preventDefault();
			onRemove?.(items[idx].id);
			return;
		}
		if (!e.altKey) return;
		const step =
			e.key === "ArrowLeft" || e.key === "ArrowUp"
				? -1
				: e.key === "ArrowRight" || e.key === "ArrowDown"
					? 1
					: 0;
		const to = idx + step;
		if (!step || to < 0 || to >= items.length) return;
		e.preventDefault();
		const id = items[idx].id;
		move(idx, to);
		// Keep focus on the tile that moved, which Svelte re-renders in its new slot.
		queueMicrotask(() => barEl?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus());
	}
</script>

{#snippet content(shortcut: Shortcut)}
	{#if shortcut.type === "widget"}
		{#if shortcut.url !== "upcoming-schedules" && !shortcut.config?.symbol}
			<span class="placeholder">Symbol</span>
		{:else}
			{#key JSON.stringify(shortcut.config ?? {})}
				<InlineWidget widgetId={shortcut.url as WidgetId} config={shortcut.config} />
			{/key}
		{/if}
	{:else if shortcut.icon && SVG_ICONS[shortcut.icon]}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG_ICONS is a static internal map, not user input -->
		{@html SVG_ICONS[shortcut.icon]}
	{:else if shortcut.type === "external" && !shortcut.icon}
		{@const fav = getFaviconUrl(shortcut.url)}
		{#if fav}
			{#key fav}
				<img src={fav} alt="" width="20" height="20" class="favicon" onerror={onFaviconError} />
			{/key}
		{:else}
			🔗
		{/if}
	{:else}
		{shortcut.icon || "🔗"}
	{/if}
{/snippet}

<div
	class="bar"
	class:is-edit={mode === "edit"}
	style:padding
	role="list"
	bind:this={barEl}
	ondragover={onBarDragOver}
	ondrop={onBarDrop}
>
	{#each items as shortcut, idx (shortcut.id)}
		{@const isWidget = shortcut.type === "widget"}
		{@const isData = shortcut.url === "upcoming-schedules"}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- edit-mode tiles are focusable list items driven by Delete and Alt+arrows -->
		<svelte:element
			this={mode === "bar" && !isWidget ? "button" : "div"}
			class="item"
			class:is-small={shortcut.size === "small"}
			class:is-half={shortcut.size === "half"}
			class:is-wide={shortcut.size === "wide"}
			class:is-data={isData}
			class:is-dragging={dragIdx === idx}
			class:is-drop-before={dropTarget?.idx === idx && dropTarget?.side === "before"}
			class:is-drop-after={dropTarget?.idx === idx && dropTarget?.side === "after"}
			role="listitem"
			data-id={shortcut.id}
			style={colorVars(idx, mode === "edit" || !isWidget || isData)}
			title={shortcut.label}
			aria-label={mode === "edit"
				? `${shortcut.label}. Delete to remove, Alt+arrows to move`
				: undefined}
			tabindex={mode === "edit" ? 0 : undefined}
			draggable="true"
			onclick={mode === "bar" && !isWidget
				? (e: MouseEvent) => onActivate?.(shortcut, e.currentTarget as HTMLElement)
				: undefined}
			onkeydown={mode === "edit" ? (e: KeyboardEvent) => onEditKey(idx, e) : undefined}
			ondragstart={(e: DragEvent) => onDragStart(idx, e)}
			ondragend={onDragEnd}
			animate:flip={{ duration: 180 }}
			in:scale={{ start: 0.8, duration: 180 }}
		>
			<span class="item__content">{@render content(shortcut)}</span>
			{#if mode === "edit"}
				<button
					type="button"
					class="item__remove"
					tabindex="-1"
					aria-label="Remove {shortcut.label}"
					onclick={() => onRemove?.(shortcut.id)}
				>
					<X size={11} strokeWidth={2.5} />
				</button>
			{/if}
		</svelte:element>
	{/each}

	{#if ghost}
		<div
			class="item is-ghost"
			class:is-small={ghost.size === "small"}
			class:is-half={ghost.size === "half"}
			class:is-wide={ghost.size === "wide"}
			class:is-data={ghost.url === "upcoming-schedules"}
			style={colorVars(items.length, false)}
			aria-hidden="true"
		>
			<span class="item__content">{@render content(ghost)}</span>
		</div>
	{/if}

	{@render trailing?.()}
</div>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex-shrink: 0;
		align-items: center;
	}

	.item {
		position: relative;
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
		min-width: 0;
		font: inherit;
		transition:
			background 0.12s,
			transform 0.12s,
			box-shadow 0.12s,
			opacity 0.12s;
	}

	.item__content {
		display: flex;
		align-items: center;
		justify-content: inherit;
		width: 100%;
		height: 100%;
		min-width: 0;
		overflow: hidden;
		border-radius: inherit;
	}

	.item:hover {
		background: var(--sc-bg-hover);
		transform: scale(1.0105);
		box-shadow: 0 1px 4px var(--sc-shadow);
	}

	.item.is-small {
		width: 38px;
		flex: 0 0 38px;
		font-size: 17px;
	}

	.item.is-half {
		flex: 1 1 calc(50% - 3px);
		font-size: var(--abt-text-base);
		justify-content: flex-start;
	}

	.item.is-wide {
		flex: 1 1 100%;
		font-size: var(--abt-text-base);
		justify-content: flex-start;
	}

	.item.is-data {
		height: auto;
		min-height: 38px;
	}

	.item.is-dragging {
		opacity: 0.3;
	}

	.placeholder {
		padding: 0 8px;
		font-size: var(--abt-text-sm);
		opacity: 0.5;
	}

	.favicon {
		border-radius: var(--abt-radius-sm);
		object-fit: contain;
		display: block;
	}

	/* ── Edit mode ── */

	.is-edit .item {
		cursor: grab;
	}

	.is-edit .item:active {
		cursor: grabbing;
	}

	/* Widgets are previews here: their own clicks and hovers would fight the drag. */
	.is-edit .item__content {
		pointer-events: none;
	}

	.is-edit .item:focus-visible {
		outline: 2px solid var(--abt-accent);
		outline-offset: 2px;
	}

	.item__remove {
		position: absolute;
		top: -5px;
		right: -5px;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-pill);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		color: var(--color-pageText);
		cursor: pointer;
		opacity: 0;
		transform: scale(0.8);
		transition:
			opacity 0.12s,
			transform 0.12s,
			background 0.12s;
	}

	.item:hover .item__remove,
	.item:focus-visible .item__remove {
		opacity: 1;
		transform: none;
	}

	.item__remove:hover {
		background: var(--color-errorText);
		border-color: transparent;
		color: var(--color-pageBackground);
	}

	.item.is-ghost {
		outline: 1.5px dashed color-mix(in srgb, var(--color-sidebarItemText) 40%, transparent);
		outline-offset: -1.5px;
		opacity: 0.6;
		pointer-events: none;
		animation: ghost-in 0.15s ease-out;
	}

	@keyframes ghost-in {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
	}

	/* ── Drop indicators: a line beside small and half tiles, above or below full-width ones ── */

	.item.is-drop-before::before,
	.item.is-drop-after::after {
		content: "";
		position: absolute;
		border-radius: 1px;
		background: var(--color-sidebarItemAccentSelected);
	}

	.item.is-small.is-drop-before::before,
	.item.is-small.is-drop-after::after,
	.item.is-half.is-drop-before::before,
	.item.is-half.is-drop-after::after {
		top: 4px;
		bottom: 4px;
		width: 2px;
	}

	.item.is-small.is-drop-before::before,
	.item.is-half.is-drop-before::before {
		left: -4px;
	}

	.item.is-small.is-drop-after::after,
	.item.is-half.is-drop-after::after {
		right: -4px;
	}

	.item.is-wide.is-drop-before::before,
	.item.is-wide.is-drop-after::after {
		left: 4px;
		right: 4px;
		height: 2px;
	}

	.item.is-wide.is-drop-before::before {
		top: -4px;
	}

	.item.is-wide.is-drop-after::after {
		bottom: -4px;
	}

	@media (prefers-reduced-motion: reduce) {
		.item,
		.item.is-ghost {
			transition: none;
			animation: none;
		}
	}
</style>
