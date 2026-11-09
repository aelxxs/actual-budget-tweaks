<script lang="ts">
	import { Plus, X } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { arrowStep, dragArea } from "./drag";
	import { type Generated, glowLayers, lightColor } from "./generator";
	import { studio } from "./state.svelte";

	const { g }: { g: Generated } = $props();

	const MAX_LIGHTS = 3;
	// Lights may sit just off the window, so the glow comes in from outside; their handles stay
	// drawn this far inside the map.
	const EDGE = 10;
	const inside = (px: number, size: number) => Math.min(size - EDGE, Math.max(EDGE, px));
	const r = $derived(studio.recipe);
	const selected = $derived(r.glow.lights[studio.light]);

	// The map is the window as laid out: the sidebar (and its icon rail) full height, the header
	// across the rest, and under it the page and this panel, each starting with a toolbar row.
	let layout = $state({
		aspect: 16 / 9,
		sidebar: 0.15,
		rail: 0,
		panel: 0.25,
		header: 0.07,
		toolbar: 0.06,
	});
	function measure() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		const width = (selector: string) =>
			document.querySelector(selector)?.getBoundingClientRect().width ?? 0;
		const height = (selector: string) =>
			document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
		const side = width(".sidebar");
		layout = {
			aspect: Math.min(2.4, Math.max(1.2, w / h)),
			sidebar: side / w,
			rail: side ? width(".sidebar .activity-bar") / side : 0,
			panel: width("[data-abt-side-drawer-sidebar]") / w,
			header: height("[data-abt-header]") / h,
			// The month row and the panel's title row line up; the panel's is the one ABT draws.
			toolbar: (height(".abt-side-drawer-header") || 51) / h,
		};
	}
	onMount(() => {
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	});

	let mapWidth = $state(300);
	const mapHeight = $derived(mapWidth / layout.aspect);
	const layers = $derived(glowLayers(r, g.colors, mapWidth, mapHeight).join(", ") || "none");

	// The size handle sits on the ring's lower-right diagonal, or the first diagonal on the map.
	const DIAGONALS: [number, number][] = [
		[1, 1],
		[-1, 1],
		[1, -1],
		[-1, -1],
	];
	function knobAt(cx: number, cy: number, radius: number): [number, number] {
		const d = radius * Math.SQRT1_2;
		const fits = (x: number, y: number) =>
			x >= EDGE && x <= mapWidth - EDGE && y >= EDGE && y <= mapHeight - EDGE;
		const [sx, sy] = DIAGONALS.find(([sx, sy]) => fits(cx + sx * d, cy + sy * d)) ?? [1, 1];
		return [inside(cx + sx * d, mapWidth), inside(cy + sy * d, mapHeight)];
	}

	// The remove button sits beside the light, on whichever side keeps it on the map.
	const REMOVE_OFFSET = 22;
	function removeAt(cx: number, cy: number): [number, number] {
		const x = inside(cx, mapWidth);
		const y = inside(cy, mapHeight);
		const side = x + REMOVE_OFFSET <= mapWidth - EDGE ? 1 : -1;
		return [x + side * REMOVE_OFFSET, y];
	}

	// What the press grabbed: a light's centre, its size handle, or the map (moves the selected one).
	let grab: { index: number; part: "move" | "size" } | null = null;
	function start(e: PointerEvent): boolean {
		const target = e.target as Element;
		if (!r.glow.on || !r.glow.lights.length || target.closest(".remove")) {
			return false;
		}
		const hit = target.closest<HTMLElement>("[data-light]");
		const index = hit ? Number(hit.dataset.light) : studio.light;
		studio.light = index;
		grab = { index, part: hit?.dataset.part === "size" ? "size" : "move" };
		return true;
	}
	function move(fx: number, fy: number, e: PointerEvent, box: DOMRect) {
		const light = grab && studio.recipe.glow.lights[grab.index];
		if (!grab || !light) {
			return;
		}
		if (grab.part === "size") {
			const dx = e.clientX - box.left - light.x * box.width;
			const dy = e.clientY - box.top - light.y * box.height;
			light.size = Math.min(0.9, Math.max(0.08, Math.hypot(dx, dy) / box.width));
		} else {
			light.x = Math.min(1.1, Math.max(-0.1, fx));
			light.y = Math.min(1.1, Math.max(-0.1, fy));
		}
	}
	function onKey(e: KeyboardEvent, index: number) {
		if (e.key === "Delete" || e.key === "Backspace") {
			removeLight(index);
			return;
		}
		const step = arrowStep(e);
		const light = studio.recipe.glow.lights[index];
		if (step && light) {
			studio.light = index;
			light.x = Math.min(1.1, Math.max(-0.1, light.x + step[0] * 0.02));
			light.y = Math.min(1.1, Math.max(-0.1, light.y + step[1] * 0.03));
		}
	}

	function addLight() {
		const lights = studio.recipe.glow.lights;
		lights.push({
			x: 0.5,
			y: 0.5,
			size: 0.35,
			strength: 45,
			color: lights.length ? "second" : "accent",
		});
		studio.light = lights.length - 1;
		studio.recipe.glow.on = true;
	}
	function removeLight(index: number) {
		studio.recipe.glow.lights.splice(index, 1);
		studio.light = Math.max(0, Math.min(studio.light, studio.recipe.glow.lights.length - 1));
		if (!studio.recipe.glow.lights.length) {
			studio.recipe.glow.on = false;
		}
	}
	function setColor(color: string) {
		if (selected) {
			selected.color = color;
		}
	}
	const custom = $derived(!!selected && selected.color.startsWith("#"));

	// Line lengths, as fractions of their column, for a budget-like rhythm.
	const SUMMARY = [0, 1, 2, 3];
	const ROWS = [0.55, 0.42, 0.6, 0.38, 0.5, 0.36, 0.48];
	const ACCOUNTS = [0.8, 0.7, 0.75, 0.6, 0.72, 0.66, 0.78];
</script>

<div
	class="map"
	class:off={!r.glow.on}
	style:aspect-ratio={layout.aspect}
	style:--m-line={g.colors.overlay0}
	style:--m-card={g.colors.mantle}
	style:--m-side-line={g.sidebar.sub}
	bind:clientWidth={mapWidth}
	use:dragArea={{ move, start }}
>
	<span
		class="region side"
		style:width="{layout.sidebar * 100}%"
		style:background={g.sidebar.bg}
		style:--rail="{layout.rail * 100}%"
	>
		{#if layout.rail}
			<span class="rail">
				<i class="logo" style:background={g.sidebar.sel}></i>
				{#each [0, 1, 2, 3] as i (i)}<i class:on={i === 1}></i>{/each}
			</span>
		{/if}
		<span class="list">
			<i class="name"></i>
			<i class="widget"></i>
			{#each ACCOUNTS as w, i (i)}
				<i class="bar" style:width="{w * 100}%"></i>
			{/each}
		</span>
	</span>
	<span
		class="region header"
		style:left="{layout.sidebar * 100}%"
		style:height="{layout.header * 100}%"
		style:background={g.colors.crust}
	>
		<i class="pill" style:background={g.colors.yellow}></i>
		<span class="icons"
			>{#each [0, 1, 2] as i (i)}<i></i>{/each}</span
		>
	</span>
	<span
		class="region page"
		style:left="{layout.sidebar * 100}%"
		style:right="{layout.panel * 100}%"
		style:top="{layout.header * 100}%"
		style:background={g.colors.crust}
	>
		<span class="toolbar" style:height="{layout.toolbar * mapHeight}px">
			<i class="chip"></i>
			<i class="title"></i>
			<i class="chip wide"></i>
		</span>
		<span class="content">
			<span class="cards">
				{#each SUMMARY as i (i)}<i></i>{/each}
			</span>
			<span class="table">
				{#each ROWS as w, i (i)}
					<i class="bar" style:width="{w * 100}%"></i>
				{/each}
			</span>
		</span>
	</span>
	{#if layout.panel}
		<span
			class="region panel"
			style:width="{layout.panel * 100}%"
			style:top="{layout.header * 100}%"
			style:background={g.colors.crust}
		>
			<span class="toolbar" style:height="{layout.toolbar * mapHeight}px">
				<i class="title"></i>
			</span>
			<span class="content">
				<span class="tabs">
					<i style:background={g.colors.mauve}></i><i></i><i></i>
				</span>
				<i class="block short"></i>
				<i class="block"></i>
				<i class="block"></i>
			</span>
		</span>
	{/if}

	{#if r.glow.on}
		<span class="glow" style:background={layers}></span>
		{#each r.glow.lights as light, i (i)}
			{@const cx = light.x * mapWidth}
			{@const cy = light.y * mapHeight}
			{@const radius = light.size * mapWidth}
			{@const knob = knobAt(cx, cy, radius)}
			{@const remove = removeAt(cx, cy)}
			{#if i === studio.light}
				<span
					class="ring"
					style:left="{cx}px"
					style:top="{cy}px"
					style:width="{radius * 2}px"
					style:height="{radius * 2}px"
				></span>
				<span
					class="knob"
					data-light={i}
					data-part="size"
					title="Drag to resize"
					style:left="{knob[0]}px"
					style:top="{knob[1]}px"
				></span>
				<button
					type="button"
					class="remove"
					title="Remove this light"
					aria-label="Remove light {i + 1}"
					style:left="{remove[0]}px"
					style:top="{remove[1]}px"
					onclick={() => removeLight(i)}
				>
					<X size={10} strokeWidth={3} />
				</button>
			{/if}
			<span
				class="core"
				class:selected={i === studio.light}
				data-light={i}
				data-part="move"
				role="slider"
				tabindex="0"
				aria-label="Glow light {i + 1}"
				aria-valuenow={Math.round(light.x * 100)}
				title="Drag to move"
				style:left="{inside(cx, mapWidth)}px"
				style:top="{inside(cy, mapHeight)}px"
				style:--light={lightColor(light, g.colors)}
				onkeydown={(e) => onKey(e, i)}
			></span>
		{/each}
	{/if}
</div>

<div class="controls" class:dim={!r.glow.on}>
	<div class="lights" role="group" aria-label="Lights">
		{#each r.glow.lights as light, i (i)}
			<button
				type="button"
				class="abt-btn abt-btn--sm light-chip"
				aria-pressed={i === studio.light}
				onclick={() => (studio.light = i)}
			>
				<span class="dot" style:background={lightColor(light, g.colors)}></span>
				Light {i + 1}
			</button>
		{/each}
		<button
			type="button"
			class="abt-btn abt-btn--sm"
			disabled={r.glow.lights.length >= MAX_LIGHTS}
			title={r.glow.lights.length >= MAX_LIGHTS ? `Up to ${MAX_LIGHTS} lights` : "Add a light"}
			onclick={addLight}
		>
			<Plus size={13} strokeWidth={2.2} /> Add
		</button>
	</div>

	<div class="row" class:dim={!selected}>
		<span class="row-label">Color</span>
		<div class="abt-seg abt-seg--sm options" role="group" aria-label="Light color">
			<button
				type="button"
				aria-pressed={selected?.color === "accent"}
				onclick={() => setColor("accent")}
			>
				<span class="dot" style:background={g.colors.mauve}></span> Accent
			</button>
			<button
				type="button"
				aria-pressed={selected?.color === "second"}
				onclick={() => setColor("second")}
			>
				<span class="dot" style:background={g.colors.sapphire}></span> Second
			</button>
			<!-- The color input itself, invisible over the option, so the click opens it directly. -->
			<label class="seg-option" data-pressed={custom} title="Pick any color">
				<span class="dot hues" style:background={custom ? selected?.color : undefined}></span>
				Custom
				<input
					class="picker"
					type="color"
					aria-label="Custom light color"
					value={custom ? selected?.color : "#ff8a5c"}
					oninput={(e) => setColor(e.currentTarget.value)}
				/>
			</label>
		</div>
	</div>

	<label class="row" class:dim={!selected}>
		<span class="row-label">Brightness</span>
		<input
			type="range"
			min="5"
			max="100"
			value={selected?.strength ?? 50}
			oninput={(e) => {
				if (selected) {
					selected.strength = Number(e.currentTarget.value);
				}
			}}
		/>
		<span class="value">{selected ? `${selected.strength}%` : ""}</span>
	</label>
</div>

<style>
	.map {
		position: relative;
		width: 100%;
		overflow: hidden;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		cursor: crosshair;
		touch-action: none;
		user-select: none;
	}
	.map.off {
		cursor: default;
		opacity: 0.6;
	}

	/* A sketch of the window, so a light's place reads against what it lights. */
	.region {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}
	.region i {
		display: block;
		flex: none;
	}
	.bar,
	.title,
	.name {
		border-radius: var(--abt-radius-pill);
		background: var(--m-line);
		opacity: 0.5;
	}
	.side {
		flex-direction: row;
	}
	/* Padding in px: a percentage would be of the whole map's width, not the region's. */
	/* The icon rail: darker, as the sidebar draws it. */
	.rail {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: var(--rail);
		padding-top: 6px;
		background: color-mix(in srgb, black 12%, transparent);
	}
	.rail i {
		width: 45%;
		aspect-ratio: 1;
		border-radius: var(--abt-radius-sm);
		background: var(--m-side-line);
		opacity: 0.35;
	}
	.rail i.logo {
		width: 60%;
		margin-bottom: 4px;
		opacity: 1;
	}
	.rail i.on {
		opacity: 0.8;
	}
	.list {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 5px;
		min-width: 0;
		padding: 7px 6px;
	}
	.list .name {
		width: 65%;
		height: 4px;
		margin-bottom: 3px;
		background: var(--m-side-line);
		opacity: 0.9;
	}
	.list .widget {
		height: 10px;
		margin-bottom: 4px;
		border-radius: var(--abt-radius-sm);
		background: var(--m-card);
	}
	.list .bar {
		height: 2px;
		background: var(--m-side-line);
	}
	.header {
		right: 0;
		bottom: auto;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 0 8px;
		border-left: 1px solid var(--abt-line);
		border-bottom: 1px solid var(--abt-line);
	}
	.header .pill {
		width: 18%;
		height: 38%;
		border-radius: var(--abt-radius-pill);
		opacity: 0.25;
	}
	.icons {
		display: flex;
		gap: 4px;
	}
	.icons i {
		width: 4px;
		height: 4px;
		border-radius: var(--abt-radius-pill);
		background: var(--m-line);
	}
	.page {
		border-left: 1px solid var(--abt-line);
	}
	/* The month row on the page, the title row on the panel. */
	.toolbar {
		display: flex;
		flex: none;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		padding: 0 8px;
		border-bottom: 1px solid var(--abt-line);
	}
	.toolbar .chip {
		width: 12%;
		height: 30%;
		border-radius: var(--abt-radius-sm);
		background: var(--m-card);
	}
	.toolbar .chip.wide {
		width: 22%;
		margin-left: auto;
	}
	.title {
		width: 22%;
		height: 4px;
		opacity: 0.7;
	}
	.content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 6px;
		min-height: 0;
		padding: 8px;
	}
	.cards {
		display: grid;
		flex: none;
		grid-template-columns: repeat(4, 1fr);
		gap: 5px;
		height: 18%;
	}
	.cards i,
	.table,
	.block {
		border-radius: var(--abt-radius-sm);
		background: var(--m-card);
	}
	.table {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: space-evenly;
		padding: 3px 8px;
	}
	.table .bar {
		height: 2px;
	}
	.panel {
		left: auto;
		right: 0;
		border-left: 1px solid var(--abt-line);
	}
	.panel .title {
		width: 55%;
	}
	.panel .content {
		gap: 5px;
		padding: 6px 7px;
	}
	.tabs {
		display: flex;
		flex: none;
		gap: 5px;
		margin-bottom: 2px;
	}
	.tabs i {
		width: 22%;
		height: 3px;
		border-radius: var(--abt-radius-pill);
		background: var(--m-line);
		opacity: 0.5;
	}
	.tabs i:first-child {
		opacity: 1;
	}
	.block {
		height: 20%;
	}
	.block.short {
		height: 8%;
	}

	.glow {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/* Only the selected light shows its reach, so the rings don't crowd the map. */
	.ring {
		position: absolute;
		border: 1px dashed color-mix(in srgb, white 55%, transparent);
		border-radius: var(--abt-radius-pill);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
	.core,
	.knob,
	.remove {
		position: absolute;
		border-radius: var(--abt-radius-pill);
		transform: translate(-50%, -50%);
	}
	.core {
		width: 14px;
		height: 14px;
		border: 2px solid white;
		background: var(--light);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
		cursor: move;
		outline: none;
	}
	.core.selected {
		width: 18px;
		height: 18px;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.35),
			0 0 0 5px color-mix(in srgb, white 25%, transparent);
	}
	.core:focus-visible {
		box-shadow: 0 0 0 3px var(--abt-accent);
	}
	.knob {
		width: 11px;
		height: 11px;
		background: white;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
		cursor: nwse-resize;
	}
	.remove {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 1px solid color-mix(in srgb, white 30%, transparent);
		background: rgba(0, 0, 0, 0.6); /* raw: over any glow */
		color: white;
		cursor: pointer;
	}
	.remove:hover {
		background: rgba(0, 0, 0, 0.85); /* raw: over any glow */
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
	}
	.dim {
		opacity: 0.5;
		pointer-events: none;
	}
	.lights {
		display: flex;
		flex-wrap: wrap;
		gap: var(--abt-space-3);
	}
	.light-chip[aria-pressed="true"] {
		--abt-btn-line: var(--abt-accent-4);
		--abt-btn-bg: var(--abt-accent-2);
		color: var(--abt-accent-text);
	}
	.dot {
		flex: none;
		width: 9px;
		height: 9px;
		border-radius: var(--abt-radius-pill);
	}
	.dot.hues {
		background: conic-gradient(
			#f87171,
			#fbbf24,
			#4ade80,
			#22d3ee,
			#818cf8,
			#e879f9,
			#f87171
		); /* raw: a hue ring */
	}
	.row {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.row-label {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.options {
		position: relative;
		display: flex;
		grid-column: 2 / -1;
	}
	.options > button {
		flex: 1;
		justify-content: center;
	}
	/* Shaped like the segmented buttons beside it; a label, so it can hold the color input. */
	.seg-option {
		position: relative;
		display: inline-flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: var(--abt-space-2);
		height: 100%;
		padding: 0 var(--abt-space-3);
		border-radius: max(0px, calc(var(--abt-radius) - 3px));
		color: var(--abt-muted);
		font-size: var(--abt-text-sm);
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
	}
	.seg-option:hover {
		color: var(--abt-ink);
	}
	.seg-option[data-pressed="true"] {
		background: var(--abt-selected-bg);
		color: var(--abt-selected-fg);
	}
	.picker {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		opacity: 0;
		cursor: pointer;
	}
	.row input[type="range"] {
		width: 100%;
		accent-color: var(--abt-accent);
	}
	.value {
		min-width: 34px;
		font-size: var(--abt-text-sm);
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
	}
</style>
