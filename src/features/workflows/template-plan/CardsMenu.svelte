<script lang="ts">
	import { SIDEBAR_ATTR } from "@features/core/side-panel/api";
	import Switch from "@lib/components/Switch.svelte";
	import { setValue } from "@lib/utilities/store";
	import {
		ArrowLeftRight,
		Banknote,
		CalendarClock,
		CalendarDays,
		ChartColumn,
		Clock,
		GripVertical,
		type LucideIcon,
		Sparkles,
		Target,
	} from "@lucide/svelte";
	import { onMount, tick } from "svelte";
	import { backOut } from "svelte/easing";
	import { flip } from "svelte/animate";
	import { fade } from "svelte/transition";
	import {
		CARDS_KEY,
		TEMPLATES_BAR,
		type CardId,
		type CardLayout,
		cardLabel,
		defaultLayout,
	} from "./cards";
	import { templatePlanState } from "./state.svelte";

	const { anchor }: { anchor: HTMLElement } = $props();

	const ICONS: Record<CardId, LucideIcon> = {
		"this-month": CalendarDays,
		income: Banknote,
		moves: ArrowLeftRight,
		"next-month": CalendarClock,
		goals: Target,
		trend: ChartColumn,
		"coming-up": Clock,
	};

	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const motion = still ? 0 : 200;

	const layout = $derived(templatePlanState.cards);
	const barShown = $derived(!layout.hidden.includes(TEMPLATES_BAR));
	const isDefault = $derived(
		layout.hidden.length === 0 && layout.order.every((id, i) => id === defaultLayout().order[i]),
	);

	let layer: HTMLElement;
	let menu: HTMLElement;
	let listEl: HTMLElement;
	let pos = $state({ top: 0, right: 0 });

	type Ends = { sx: number; sy: number; tx: number; ty: number };
	let ends = $state<Ends | null>(null);
	const GAP = 32;

	/**
	 * Where the edge runs: from a row being moved to its card in the panel, or at rest from the
	 * menu's title to the panel's edge, level with its tabs.
	 */
	function target(): Ends | null {
		const panel = anchor.closest(`[${SIDEBAR_ATTR}]`);
		const m = menu.getBoundingClientRect();
		// Only for a card being moved; following every hovered row is too busy.
		const lit = dragging ?? keyMoving;
		if (lit) {
			const row = menu.querySelector(`[data-row="${lit}"]`)?.getBoundingClientRect();
			const slot = document.querySelector(`.abt-card-slot[data-card="${lit}"]`);
			const card = (
				slot?.querySelector(".card, .abt-tab-overview-toolbar") ?? slot
			)?.getBoundingClientRect();
			if (row && card) {
				return {
					sx: m.right,
					sy: row.top + row.height / 2,
					tx: card.left,
					ty: card.top + Math.min(card.height / 2, 20),
				};
			}
		}
		const head = menu.querySelector(".head")?.getBoundingClientRect();
		const tabs = (anchor.closest(".abt-tabs") ?? anchor).getBoundingClientRect();
		if (!head || !panel) {
			return null;
		}
		return {
			sx: m.right,
			sy: head.top + head.height / 2,
			tx: panel.getBoundingClientRect().left,
			ty: tabs.top + tabs.height / 2,
		};
	}

	// Each frame while open: the menu keeps beside the panel as it resizes, and the edge's ends ease
	// toward where they belong, so it glides from card to card instead of jumping. While the menu
	// slides in, the edge is pinned to it; easing then, it trailed the menu across its face.
	const OPENING_MS = 300;
	let openedAt: number | null = null;

	function frame(time: number) {
		openedAt ??= time;
		const panel = anchor.closest(`[${SIDEBAR_ATTR}]`) ?? anchor;
		const top = Math.max(8, anchor.getBoundingClientRect().top - 8);
		const right = innerWidth - panel.getBoundingClientRect().left + GAP;
		if (top !== pos.top || right !== pos.right) {
			pos = { top, right };
		}
		const want = target();
		const now = ends;
		if (want) {
			const snap = !now || still || time - openedAt < OPENING_MS;
			const next = snap
				? want
				: {
						sx: now.sx + (want.sx - now.sx) * 0.25,
						sy: now.sy + (want.sy - now.sy) * 0.25,
						tx: now.tx + (want.tx - now.tx) * 0.25,
						ty: now.ty + (want.ty - now.ty) * 0.25,
					};
			// Settled: no redraw until something moves.
			const moved =
				!now ||
				Math.abs(next.sx - now.sx) +
					Math.abs(next.sy - now.sy) +
					Math.abs(next.tx - now.tx) +
					Math.abs(next.ty - now.ty) >
					0.1;
			if (moved) {
				ends = next;
			}
		}
		raf = requestAnimationFrame(frame);
	}
	let raf = 0;

	const path = $derived.by(() => {
		if (!ends) {
			return "";
		}
		const { sx, sy, tx, ty } = ends;
		const pull = Math.max(12, (tx - sx) / 2);
		return `M ${sx} ${sy} C ${sx + pull} ${sy}, ${tx - pull} ${ty}, ${tx} ${ty}`;
	});

	function close() {
		templatePlanState.customizingCards = false;
	}

	onMount(() => {
		// Out of the panel, whose own box would clip a menu that sits beside it.
		document.body.append(layer);
		raf = requestAnimationFrame(frame);
		const onPointer = (e: PointerEvent) => {
			const target = e.target as Node;
			if (!menu.contains(target) && !anchor.contains(target)) {
				close();
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				close();
				anchor.focus();
			}
		};
		document.addEventListener("pointerdown", onPointer, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener("pointerdown", onPointer, true);
			document.removeEventListener("keydown", onKey, true);
			templatePlanState.highlightCard = null;
		};
	});

	function save(next: CardLayout) {
		templatePlanState.cards = next;
		void setValue(CARDS_KEY, $state.snapshot(next));
	}

	function moved(id: CardId, to: number): CardLayout {
		const order = layout.order.filter((card) => card !== id);
		order.splice(Math.max(0, Math.min(to, order.length)), 0, id);
		return { ...layout, order };
	}

	function setShown(id: CardId | typeof TEMPLATES_BAR, shown: boolean) {
		const hidden = layout.hidden.filter((card) => card !== id);
		save({ ...layout, hidden: shown ? hidden : [...hidden, id] });
	}

	// Reordered live while dragging, so the panel's cards move along; saved once it's dropped.
	let dragging = $state<CardId | null>(null);
	// Moved with the arrow keys, until its handle loses focus.
	let keyMoving = $state<CardId | null>(null);

	function onDragStart(e: DragEvent, id: CardId) {
		dragging = id;
		templatePlanState.highlightCard = id;
		const row = (e.currentTarget as HTMLElement).closest(".row");
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", id);
			if (row) {
				e.dataTransfer.setDragImage(row, 16, 16);
			}
		}
	}

	function onDragOver(e: DragEvent, id: CardId) {
		if (!dragging) {
			return;
		}
		e.preventDefault();
		const from = layout.order.indexOf(dragging);
		const to = layout.order.indexOf(id);
		if (from === to) {
			return;
		}
		// Only past the row's middle, or the row sliding out from under the pointer swaps it back.
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const past = e.clientY > rect.top + rect.height / 2;
		if ((to > from && past) || (to < from && !past)) {
			templatePlanState.cards = moved(dragging, to);
		}
	}

	function onDragEnd() {
		if (dragging) {
			save(templatePlanState.cards);
		}
		dragging = null;
	}

	async function onHandleKey(e: KeyboardEvent, id: CardId) {
		if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
			return;
		}
		e.preventDefault();
		const to = layout.order.indexOf(id) + (e.key === "ArrowUp" ? -1 : 1);
		if (to < 0 || to >= layout.order.length) {
			return;
		}
		keyMoving = id;
		save(moved(id, to));
		await tick();
		listEl.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus();
	}

	function pop(_node: Element) {
		return {
			duration: still ? 0 : 280,
			easing: backOut,
			css: (t: number, u: number) =>
				`opacity: ${Math.min(1, t * 1.6)}; transform: translateX(${u * 18}px) scale(${0.94 + 0.06 * t});`,
		};
	}

	const spotlight = (id: CardId | typeof TEMPLATES_BAR | null) => () => {
		if (!dragging) {
			templatePlanState.highlightCard = id;
		}
	};
</script>

<div bind:this={layer} class="layer">
	<!-- The edge between the menu and the panel, like a link between two nodes. -->
	<svg class="edge" aria-hidden="true" transition:fade={{ duration: still ? 0 : 150 }}>
		{#if ends}
			<path d={path} pathLength="1" />
			<circle cx={ends.sx} cy={ends.sy} r="3.5" />
			<circle cx={ends.tx} cy={ends.ty} r="3.5" />
		{/if}
	</svg>
	<div
		bind:this={menu}
		class="menu abt-popover"
		style:top="{pos.top}px"
		style:right="{pos.right}px"
		role="dialog"
		aria-label="Overview cards"
		transition:pop
	>
		<div class="head">
			<span class="title">Overview cards</span>
			<span class="hint">Drag to reorder, switch to hide</span>
		</div>

		<div
			class="row fixed"
			role="group"
			aria-label="Templates bar"
			data-row={TEMPLATES_BAR}
			onpointerenter={spotlight(TEMPLATES_BAR)}
			onpointerleave={spotlight(null)}
		>
			<span class="tile" data-off={!barShown || undefined}><Sparkles size={14} /></span>
			<label class="toggle">
				<span class="name">Templates bar</span>
				<Switch checked={barShown} onCheckedChange={(on) => setShown(TEMPLATES_BAR, on)} />
			</label>
		</div>

		<div class="divider"></div>

		<div class="list" role="list" bind:this={listEl}>
			{#each layout.order as id (id)}
				{@const shown = !layout.hidden.includes(id)}
				{@const CardIcon = ICONS[id]}
				<div
					class="row"
					class:dragging={dragging === id}
					role="listitem"
					data-row={id}
					ondragover={(e) => onDragOver(e, id)}
					ondrop={(e) => e.preventDefault()}
					onpointerenter={spotlight(id)}
					onpointerleave={spotlight(null)}
					onfocusin={spotlight(id)}
					animate:flip={{ duration: motion }}
				>
					<button
						type="button"
						class="handle"
						draggable="true"
						data-handle={id}
						title="Drag to reorder, or use the arrow keys"
						aria-label="Move {cardLabel(id)}"
						ondragstart={(e) => onDragStart(e, id)}
						ondragend={onDragEnd}
						onkeydown={(e) => onHandleKey(e, id)}
						onblur={() => (keyMoving = null)}
					>
						<GripVertical size={13} strokeWidth={1.75} />
					</button>
					<span class="tile" data-off={!shown || undefined}><CardIcon size={14} /></span>
					<label class="toggle">
						<span class="name">{cardLabel(id)}</span>
						<Switch checked={shown} onCheckedChange={(on) => setShown(id, on)} />
					</label>
				</div>
			{/each}
		</div>

		{#if !isDefault}
			<div class="foot">
				<button
					type="button"
					class="abt-btn abt-btn--sm abt-btn--ghost"
					onclick={() => save(defaultLayout())}>Reset to default</button
				>
			</div>
		{/if}
	</div>
</div>

<style>
	.menu {
		position: fixed;
		z-index: 1000;
		width: 264px;
		padding: var(--abt-space-2);
	}

	.edge {
		position: fixed;
		inset: 0;
		/* Over the menu, so the port sits whole on its border. */
		z-index: 1001;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.edge path {
		fill: none;
		stroke: var(--abt-accent);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-dasharray: 1;
		animation: abt-edge-draw 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) 0.1s both;
	}

	.edge circle {
		fill: var(--color-pageBackground);
		stroke: var(--abt-accent);
		stroke-width: 1.5;
		animation: abt-edge-port 0.2s ease-out 0.1s both;
	}

	@keyframes abt-edge-draw {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes abt-edge-port {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.edge path,
		.edge circle {
			animation: none;
		}
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		padding: var(--abt-space-1) var(--abt-space-2) var(--abt-space-3);
	}

	.title {
		font-size: var(--abt-text-md);
		font-weight: 600;
	}

	.hint {
		font-size: var(--abt-text-sm);
		color: var(--color-pageTextSubdued);
	}

	.list {
		display: flex;
		flex-direction: column;
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding: var(--abt-space-2);
		border-radius: var(--abt-radius-sm);
		transition: background 0.12s;
	}

	.row:hover {
		background: var(--abt-fill);
	}

	.row.fixed {
		padding-left: calc(var(--abt-space-2) + 22px);
	}

	.row.dragging {
		background: var(--abt-accent-2);
	}

	.handle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-subtle);
		cursor: grab;
	}

	.handle:active {
		cursor: grabbing;
	}

	.handle:focus-visible {
		outline: 2px solid var(--abt-accent-4);
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 26px;
		height: 26px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-accent-2);
		color: var(--abt-accent);
		transition:
			background 0.2s,
			color 0.2s;
	}

	.tile[data-off] {
		background: var(--abt-ink-2);
		color: var(--abt-subtle);
	}

	.toggle {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--abt-space-2);
		min-width: 0;
		cursor: pointer;
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: var(--abt-text-md);
	}

	.tile[data-off] + .toggle .name {
		color: var(--color-pageTextSubdued);
	}

	.divider {
		height: 1px;
		margin: var(--abt-space-1) var(--abt-space-2);
		background: var(--abt-line);
	}

	.foot {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--abt-space-2);
	}
</style>
