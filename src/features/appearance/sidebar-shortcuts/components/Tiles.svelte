<script lang="ts">
	import { getFaviconUrl } from "@lib/utilities/favicon";
	import { icon } from "@lib/utilities/icons";
	import { X } from "@lucide/svelte";
	import { onDestroy, tick, type Snippet } from "svelte";
	import type { AnimationConfig } from "svelte/animate";
	import { cubicOut } from "svelte/easing";
	import { scale } from "svelte/transition";
	import {
		GAP,
		dropLines,
		fits,
		sameTarget,
		pickSwap,
		pickTarget,
		placeTiles,
		previewLines,
		toLines,
		withExtras,
		type Band,
		type Target,
	} from "../rows";
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
		/** Whether `trailing` draws anything, so it isn't given room when it doesn't. */
		hasTrailing?: boolean;
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
		hasTrailing = false,
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

	const MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1;
	const FLIP_MS = 180 * MOTION;
	const LAND_MS = 140 * MOTION;
	const DRAG_THRESHOLD = 5;
	// How far outside the bar a drag still reorders.
	const DRAG_REACH = 32;
	const TRAILING_ID = "abt-trailing";
	const GHOST_ID = "abt-ghost";

	let width = $state(240);
	// Tiles snap to a new width: sliding them would trail behind the sidebar's edge.
	let resizing = false;
	let resizeTimer: ReturnType<typeof setTimeout> | undefined;
	const lines = $derived(toLines(items, width));
	// While dragging, tiles follow `draft`; `items` only changes once on drop.
	let draft = $state<Shortcut[][] | null>(null);
	let dragId = $state<string | null>(null);
	let newRowLine = $state<{ top: number; left: number; width: number } | null>(null);
	const shownLines = $derived(draft ?? lines);
	const shown = $derived(shownLines.flat());
	const placed = $derived.by(() => {
		const extras: Pick<Shortcut, "id" | "size" | "url">[] = [];
		if (ghost) {
			extras.push({ ...ghost, id: GHOST_ID });
		}
		if (hasTrailing) {
			extras.push({ id: TRAILING_ID, size: "small", url: "" });
		}
		return placeTiles(withExtras(shownLines, extras, width), width);
	});

	function placement(id: string): string {
		const spot = placed.get(id);
		return spot
			? `grid-row: ${spot.line + 1}; margin-left: ${spot.left}px; width: ${spot.width}px;`
			: "";
	}

	let press: {
		id: string;
		el: HTMLElement;
		startX: number;
		startY: number;
		grabX: number;
		grabY: number;
		x: number;
		y: number;
		clone: HTMLElement | null;
		lines: Shortcut[][];
		bands: Band[];
		bar: DOMRect | null;
		origin: Target & { kind: "join" };
		target: Target;
	} | null = null;
	let barEl: HTMLDivElement | undefined = $state();
	let focusedId = $state<string | null>(null);
	// Tiles arrive after the bar on load; only ones added later scale in.
	let animateIn = $state(false);
	$effect(() => {
		if (items.length && !animateIn) {
			// After the first tiles' intros have read their (zero) duration.
			requestAnimationFrame(() => (animateIn = true));
		}
	});

	$effect(() => {
		const el = barEl;
		if (!el) {
			return;
		}
		let awaited: Animation | null = null;
		const measure = () => {
			const style = getComputedStyle(el);
			let inner = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			// While the sidebar's width animates, rows split for each frame would jump (and a panel
			// mounting mid-animation would re-split once it ends), so they take the width it's headed to.
			const sidebar = el.closest(".sidebar");
			const transition = sidebar
				?.getAnimations()
				.find((a) => a instanceof CSSTransition && a.transitionProperty === "width");
			const effect = transition?.effect;
			const target =
				effect instanceof KeyframeEffect
					? parseFloat(String(effect.getKeyframes().at(-1)?.width))
					: 0;
			if (sidebar && target) {
				inner = Math.round(inner + target - sidebar.getBoundingClientRect().width);
				if (transition && transition !== awaited) {
					awaited = transition;
					void transition.finished.then(measure, () => {});
				}
			}
			if (inner > 0 && inner !== width) {
				resizing = true;
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(() => (resizing = false), 150);
				width = inner;
			}
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});

	function onTilePress(e: PointerEvent, id: string) {
		const target = e.target as Element;
		if (e.button !== 0 || press || target.closest("input, select, textarea, .item__remove")) {
			return;
		}
		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		press = {
			id,
			el,
			startX: e.clientX,
			startY: e.clientY,
			grabX: e.clientX - rect.left,
			grabY: e.clientY - rect.top,
			x: e.clientX,
			y: e.clientY,
			clone: null,
			lines: [],
			bands: [],
			bar: null,
			origin: { kind: "join", line: 0, at: 0 },
			target: { kind: "join", line: 0, at: 0 },
		};
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("keydown", onDragKey, true);
	}

	/** The lines as they stand, for every later decision in the drag to read from. */
	function measureBands(from: Shortcut[][]): Band[] {
		const bar = barEl!;
		return from.map((line) => {
			const tiles = line.map((tile) => {
				const rect = bar.querySelector(`[data-id="${tile.id}"]`)!.getBoundingClientRect();
				return { id: tile.id, rect };
			});
			return {
				top: Math.min(...tiles.map((t) => t.rect.top)),
				bottom: Math.max(...tiles.map((t) => t.rect.bottom)),
				tiles: tiles.map((t) => ({ id: t.id, center: t.rect.left + t.rect.width / 2 })),
			};
		});
	}

	// A floating copy follows the pointer, so the real tile can hold its slot as the others reflow.
	function liftTile(active: NonNullable<typeof press>) {
		active.lines = lines;
		active.bands = measureBands(lines);
		active.bar = barEl!.getBoundingClientRect();
		const line = lines.findIndex((l) => l.some((s) => s.id === active.id));
		active.origin = {
			kind: "join",
			line,
			at: lines[line].findIndex((s) => s.id === active.id),
		};
		active.target = active.origin;
		const rect = active.el.getBoundingClientRect();
		const clone = active.el.cloneNode(true) as HTMLElement;
		Object.assign(clone.style, {
			position: "fixed",
			top: "0",
			left: "0",
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			margin: "0",
			zIndex: "30000",
			pointerEvents: "none",
			transition: "none",
			cursor: "grabbing",
			background: "linear-gradient(var(--sc-bg), var(--sc-bg)), var(--color-menuBackground)",
			boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
		});
		document.body.appendChild(clone);
		active.clone = clone;
		dragId = active.id;
		draft = lines;
	}

	const cloneTransform = (x: number, y: number, scale = 1.03) =>
		`translate3d(${x}px, ${y}px, 0) scale(${scale})`;

	function onPointerMove(e: PointerEvent) {
		if (!press) {
			return;
		}
		press.x = e.clientX;
		press.y = e.clientY;
		if (!press.clone) {
			if (Math.hypot(press.x - press.startX, press.y - press.startY) < DRAG_THRESHOLD) {
				return;
			}
			liftTile(press);
		}
		press.clone!.style.transform = cloneTransform(press.x - press.grabX, press.y - press.grabY);
		retarget(press);
	}

	// Position only: svelte's `flip` scales too, which stretches the text in tiles changing width.
	function slide(
		_node: Element,
		{ from, to }: { from: DOMRect; to: DOMRect },
		{ duration }: { duration: number },
	): AnimationConfig {
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		return {
			duration: resizing ? 0 : duration,
			easing: cubicOut,
			css: (_t, u) => `transform: translate(${u * dx}px, ${u * dy}px);`,
		};
	}

	function distanceTo(rect: DOMRect, x: number, y: number): number {
		const dx = Math.max(rect.left - x, 0, x - rect.right);
		const dy = Math.max(rect.top - y, 0, y - rect.bottom);
		return Math.hypot(dx, dy);
	}

	function retarget(active: NonNullable<typeof press>) {
		const { id, lines: from, bands, origin, bar } = active;
		if (!bar || distanceTo(bar, active.x, active.y) > DRAG_REACH) {
			return;
		}
		let target = pickTarget(bands, id, active.x, active.y, active.target);
		const alone = from[origin.line].length === 1;
		if (
			target.kind === "new" &&
			alone &&
			(target.gap === origin.line || target.gap === origin.line + 1)
		) {
			target = origin;
		}
		if (target.kind === "join" && target.line !== origin.line) {
			const tile = from[origin.line][origin.at];
			if (!fits(from[target.line], tile, width)) {
				const band = bands[target.line];
				target = pickSwap(from, band, id, active.x, width, active.target) ?? origin;
			}
		}
		// Redrawing restarts tiles' slides, so a pointer moving within one target must change nothing.
		if (sameTarget(target, active.target)) {
			return;
		}
		active.target = target;
		// A new row is only a line until the drop, so tiles stay put while passing through a gap.
		if (target.kind !== "new") {
			draft = previewLines(from, id, target);
		}
		newRowLine = target.kind === "new" ? gapLine(bands, target.gap, bar) : null;
	}

	function gapLine(bands: Band[], gap: number, bar: DOMRect) {
		const y =
			gap === 0
				? bands[0].top - GAP / 2
				: gap === bands.length
					? bands[gap - 1].bottom + GAP / 2
					: (bands[gap - 1].bottom + bands[gap].top) / 2;
		const style = getComputedStyle(barEl!);
		return { top: y - bar.top - 1, left: parseFloat(style.paddingLeft), width };
	}

	function stopListening() {
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerCancel);
		window.removeEventListener("keydown", onDragKey, true);
	}

	async function endDrag(commit: boolean) {
		const ended = press;
		press = null;
		stopListening();
		if (!ended?.clone) {
			return;
		}
		// The release would otherwise count as a click on whatever tile it lands on.
		const swallow = (e: Event) => e.stopPropagation();
		window.addEventListener("click", swallow, { capture: true, once: true });
		setTimeout(() => window.removeEventListener("click", swallow, true));

		const { target, origin } = ended;
		const moved = target.kind !== "join" || target.line !== origin.line || target.at !== origin.at;
		if (commit && moved) {
			onReorder(dropLines(ended.lines, ended.id, target));
		}
		draft = null;
		newRowLine = null;
		await tick();

		const { clone, id } = ended;
		const slot = barEl?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.getBoundingClientRect();
		const landed = () => {
			clone.remove();
			dragId = null;
		};
		if (!slot || !LAND_MS) {
			landed();
			return;
		}
		const landing = clone.animate(
			[{ transform: clone.style.transform }, { transform: cloneTransform(slot.left, slot.top, 1) }],
			{ duration: LAND_MS, easing: "ease-out", fill: "forwards" },
		);
		landing.onfinish = landed;
		landing.oncancel = landed;
	}

	const onPointerUp = () => void endDrag(true);
	const onPointerCancel = () => void endDrag(false);

	function onDragKey(e: KeyboardEvent) {
		if (e.key === "Escape" && press?.clone) {
			e.preventDefault();
			e.stopPropagation();
			void endDrag(false);
		}
	}

	onDestroy(() => {
		clearTimeout(resizeTimer);
		stopListening();
		press?.clone?.remove();
		press = null;
	});

	function move(from: number, to: number) {
		const a = [...items];
		const [moved] = a.splice(from, 1);
		a.splice(to, 0, moved);
		// Takes the row it arrives in, once rows have been saved.
		const neighbor = a[to + 1] ?? a[to - 1];
		a[to] = { ...moved, row: neighbor?.row ?? moved.row };
		onReorder(a);
	}

	function onEditKey(idx: number, e: KeyboardEvent) {
		if (e.key === "Delete" || e.key === "Backspace") {
			e.preventDefault();
			onRemove?.(items[idx].id);
			return;
		}
		if (!e.altKey) {
			return;
		}
		const step =
			e.key === "ArrowLeft" || e.key === "ArrowUp"
				? -1
				: e.key === "ArrowRight" || e.key === "ArrowDown"
					? 1
					: 0;
		const to = idx + step;
		if (!step || to < 0 || to >= items.length) {
			return;
		}
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
	class:is-sorting={dragId}
	style:padding
	role={mode === "edit" ? "listbox" : "group"}
	aria-label="Shortcuts"
	bind:this={barEl}
	ondragstart={(e) => e.preventDefault()}
>
	{#each shown as shortcut, idx (shortcut.id)}
		{@const isWidget = shortcut.type === "widget"}
		{@const isData = shortcut.url === "upcoming-schedules"}
		<!-- In edit mode, a listbox of options you rearrange (Delete, Alt+arrows); otherwise plain buttons. -->
		<svelte:element
			this={mode === "bar" && !isWidget ? "button" : "div"}
			class="item"
			class:is-small={shortcut.size === "small"}
			class:is-half={shortcut.size === "half"}
			class:is-wide={shortcut.size === "wide"}
			class:is-data={isData}
			class:is-dragging={dragId === shortcut.id}
			role={mode === "edit" ? "option" : undefined}
			aria-selected={mode === "edit" ? focusedId === shortcut.id : undefined}
			data-id={shortcut.id}
			style="{colorVars(
				draft ? items.findIndex((s) => s.id === shortcut.id) : idx,
				mode === 'edit' || !isWidget || isData,
			)}; {placement(shortcut.id)}"
			aria-label={mode === "edit"
				? `${shortcut.label}. Delete to remove, Alt+arrows to move`
				: shortcut.label}
			tabindex={mode === "edit" ? 0 : undefined}
			onpointerdown={(e: PointerEvent) => onTilePress(e, shortcut.id)}
			onclick={mode === "bar" && !isWidget
				? (e: MouseEvent) => onActivate?.(shortcut, e.currentTarget as HTMLElement)
				: undefined}
			onkeydown={mode === "edit" ? (e: KeyboardEvent) => onEditKey(idx, e) : undefined}
			onfocus={() => (focusedId = shortcut.id)}
			onblur={() => (focusedId = null)}
			animate:slide={{ duration: dragId === shortcut.id ? 0 : FLIP_MS }}
			in:scale={{ start: 0.8, duration: animateIn ? 180 : 0 }}
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
			style="{colorVars(items.length, false)}; {placement(GHOST_ID)}"
			aria-hidden="true"
		>
			<span class="item__content">{@render content(ghost)}</span>
		</div>
	{/if}

	{#if hasTrailing}
		<div class="trailing" style={placement(TRAILING_ID)}>{@render trailing?.()}</div>
	{:else}
		{@render trailing?.()}
	{/if}

	{#if newRowLine}
		<div
			class="new-row"
			style:top="{newRowLine.top}px"
			style:left="{newRowLine.left}px"
			style:width="{newRowLine.width}px"
		></div>
	{/if}
</div>

<style>
	/* Every tile sits in the one column at its own offset, set from its saved row. */
	.bar {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-auto-rows: minmax(36px, auto);
		gap: 6px;
		flex-shrink: 0;
		align-items: center;
		justify-items: start;
	}

	.item,
	.trailing {
		grid-column: 1;
	}

	.trailing {
		display: flex;
	}

	.new-row {
		position: absolute;
		height: 2px;
		border-radius: 1px;
		background: var(--color-sidebarItemAccentSelected);
		pointer-events: none;
	}

	.item {
		position: relative;
		height: 36px;
		border: none;
		border-radius: 10px; /* raw: fixed, with the sidebar search bar */
		background: var(--sc-bg);
		color: var(--color-sidebarItemText, #e0e0e0);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		min-width: 0;
		font: inherit;
		user-select: none;
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
		font-size: 17px;
	}

	.item.is-half,
	.item.is-wide {
		font-size: var(--abt-text-base);
		justify-content: flex-start;
	}

	.item.is-data {
		height: auto;
		min-height: 36px;
	}

	.item.is-dragging {
		opacity: 0.3;
	}

	/* The pointer is tracked by position, so tiles passing under it shouldn't react to hover. */
	.is-sorting .item {
		pointer-events: none;
		transition: width 0.18s ease-out;
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

	@media (prefers-reduced-motion: reduce) {
		.item,
		.item.is-ghost {
			transition: none;
			animation: none;
		}
	}
</style>
