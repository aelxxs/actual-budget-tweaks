<script lang="ts">
	import { onOutsideClick } from "@lib/dom/popover";
	import { SIDEBAR_ATTR } from "@features/core/side-panel/api";
	import { scrollParent } from "@lib/dom/dom";
	import Switch from "@lib/components/Switch.svelte";
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
		Flag,
	} from "@lucide/svelte";
	import { onMount, tick } from "svelte";
	import { backOut } from "svelte/easing";
	import { flip } from "svelte/animate";
	import { fade } from "svelte/transition";
	import { TEMPLATES_BAR, type CardId, type CardLayout, cardLabel, defaultLayout } from "./cards";
	import { templatePlanState } from "./state.svelte";

	const { anchor }: { anchor: HTMLElement } = $props();

	const ICONS: Record<CardId, LucideIcon> = {
		"this-month": CalendarDays,
		income: Banknote,
		moves: ArrowLeftRight,
		"next-month": CalendarClock,
		goals: Target,
		"long-goals": Flag,
		trend: ChartColumn,
		"coming-up": Clock,
	};

	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const motion = still ? 0 : 200;

	const layout = $derived(templatePlanState.cards);
	const cardOrder = $derived(
		layout.order.filter((id) => !templatePlanState.trackingBudget || id !== "next-month"),
	);
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
					ty: clampToCards(card.top + Math.min(card.height / 2, 20), slot),
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

	// Within the scrolling cards, never up on the panel's header, while its card is out of view.
	function clampToCards(y: number, card: Element | null): number {
		const box = card && scrollParent(card);
		if (!box) {
			return y;
		}
		const { top, bottom } = box.getBoundingClientRect();
		return Math.min(Math.max(y, top + 12), bottom - 12);
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
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				close();
				anchor.focus();
			}
		};
		const stopOutside = onOutsideClick([menu, anchor], close);
		document.addEventListener("keydown", onKey, true);
		return () => {
			stopOutside();
			cancelAnimationFrame(raf);
			removeEventListener("pointermove", onHandleMove);
			removeEventListener("pointerup", onHandleUp);
			removeEventListener("pointercancel", onHandleUp);
			document.removeEventListener("keydown", onKey, true);
			templatePlanState.highlightCard = null;
		};
	});

	function save(next: CardLayout) {
		templatePlanState.cards = next;
		templatePlanState.saveCards?.($state.snapshot(next));
	}

	function moved(id: CardId, to: number): CardLayout {
		const order = cardOrder.filter((card) => card !== id);
		order.splice(Math.max(0, Math.min(to, order.length)), 0, id);
		if (templatePlanState.trackingBudget) {
			const hiddenIndex = layout.order.indexOf("next-month");
			if (hiddenIndex >= 0) {
				order.splice(Math.min(hiddenIndex, order.length), 0, "next-month");
			}
		}
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

	// Dragged by pointer, not the browser's drag and drop, so the row stays under the cursor.
	// Slots are measured once at the start: the row's offset is from its slot, wherever that moves.
	let grab: {
		pointer: number;
		startIndex: number;
		tops: number[];
		mids: number[];
		height: number;
	} | null = null;
	let dragOffset = $state(0);
	let settling = $state<CardId | null>(null);

	function onHandleDown(e: PointerEvent, id: CardId) {
		if (e.button !== 0) {
			return;
		}
		e.preventDefault();
		// On the window: the row's element moves as the order changes, which drops pointer capture.
		addEventListener("pointermove", onHandleMove);
		addEventListener("pointerup", onHandleUp);
		addEventListener("pointercancel", onHandleUp);
		const rects = [...listEl.querySelectorAll("[data-row]")].map((row) =>
			row.getBoundingClientRect(),
		);
		const startIndex = cardOrder.indexOf(id);
		grab = {
			pointer: e.clientY,
			startIndex,
			tops: rects.map((r) => r.top),
			mids: rects.map((r) => r.top + r.height / 2),
			height: rects[startIndex]?.height ?? 0,
		};
		dragging = id;
		settling = null;
		dragOffset = 0;
		templatePlanState.highlightCard = id;
	}

	function onHandleMove(e: PointerEvent) {
		if (!dragging || !grab) {
			return;
		}
		// Where the row's top would be, moved from its starting slot by the pointer.
		const top = grab.tops[grab.startIndex] + (e.clientY - grab.pointer);
		const middle = top + grab.height / 2;
		const { startIndex, mids } = grab;
		const to = mids.filter((mid, i) => i !== startIndex && mid < middle).length;
		if (to !== cardOrder.indexOf(dragging)) {
			templatePlanState.cards = moved(dragging, to);
		}
		dragOffset = top - grab.tops[to];
	}

	function onHandleUp() {
		removeEventListener("pointermove", onHandleMove);
		removeEventListener("pointerup", onHandleUp);
		removeEventListener("pointercancel", onHandleUp);
		if (!dragging) {
			return;
		}
		save(templatePlanState.cards);
		// Eases the last few pixels into its slot instead of snapping.
		settling = dragging;
		dragging = null;
		grab = null;
		dragOffset = 0;
	}

	async function onHandleKey(e: KeyboardEvent, id: CardId) {
		if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
			return;
		}
		e.preventDefault();
		const to = cardOrder.indexOf(id) + (e.key === "ArrowUp" ? -1 : 1);
		if (to < 0 || to >= cardOrder.length) {
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
			{#each cardOrder as id (id)}
				{@const shown = !layout.hidden.includes(id)}
				{@const CardIcon = ICONS[id]}
				<div
					class="row"
					class:dragging={dragging === id}
					class:settling={settling === id}
					style:transform={dragging === id ? `translateY(${dragOffset}px)` : undefined}
					ontransitionend={(e) => e.propertyName === "transform" && (settling = null)}
					role="listitem"
					data-row={id}
					onpointerenter={spotlight(id)}
					onpointerleave={spotlight(null)}
					onfocusin={spotlight(id)}
					animate:flip={{ duration: dragging === id ? 0 : motion }}
				>
					<button
						type="button"
						class="handle"
						data-handle={id}
						aria-label="Move {cardLabel(id)}"
						onpointerdown={(e) => onHandleDown(e, id)}
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
	}

	.edge circle {
		fill: var(--color-pageBackground);
		stroke: var(--abt-accent);
		stroke-width: 1.5;
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
		color: var(--abt-muted);
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
		position: relative;
		z-index: 1;
		background: var(--abt-accent-2);
		box-shadow: 0 6px 16px -8px rgb(0 0 0 / 0.5);
		cursor: grabbing;
	}

	.row.settling {
		transition:
			background 0.12s,
			transform 0.15s ease-out;
	}

	.handle {
		touch-action: none;
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
		color: var(--abt-muted);
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
