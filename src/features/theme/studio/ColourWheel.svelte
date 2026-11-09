<script lang="ts">
	import { arrowStep, dragArea } from "./drag";
	import {
		accentLightness,
		CHROMA_CEILING,
		contrastRatio,
		type Generated,
		hexToOklch,
		type Mode,
		oklchToHex,
		oklchToRgb,
		rimChroma,
	} from "./generator";
	import { followAccent } from "./recipes";
	import { studio } from "./state.svelte";

	const { g }: { g: Generated } = $props();

	/*
	 * One wheel for both colours: the ring picks the accent's hue, the disc inside it the
	 * background's hue and tint. How strong the accent is lives on the Vibrance slider.
	 */
	const SIZE = 168;
	const RING = 14;
	const GAP = 5;
	const DISC = SIZE / 2 - RING - GAP;
	// The background handle travels inside this radius, so it stays whole at full tint.
	const TRAVEL = DISC - 10;
	const SNAP_PX = 12;
	/*
	 * Tint grows with the square of the distance out, so most of the disc covers the subtle tints
	 * real themes use and the strong ones are packed near the edge.
	 */
	const tintAt = (reach: number) => Math.min(1, Math.max(0, reach)) ** 2;
	const reachOf = (tint: number) => Math.sqrt(Math.min(1, Math.max(0, tint)));
	// A faint wash of the accent: matching it at any stronger tint colours the whole page.
	const DOT_TINT = 0.2;

	let canvas: HTMLCanvasElement | undefined = $state();
	const r = $derived(studio.recipe);

	// Brighter than the real background so hues read apart, and quieter than the ring.
	const backdrop = (mode: Mode, hue: number, tint: number): [number, number, number] => [
		mode === "dark" ? 0.34 : 0.86,
		0.004 + tint * (mode === "dark" ? 0.085 : 0.065),
		hue,
	];

	$effect(() => {
		const mode = studio.recipe.mode;
		if (!canvas) {
			return;
		}
		const scale = Math.min(2, window.devicePixelRatio || 1);
		const n = Math.round(SIZE * scale);
		canvas.width = n;
		canvas.height = n;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}
		const ringL = accentLightness(mode, 0.5);
		// Every half degree, blended between, so the ring has no seams where its strength jumps.
		const rim = Array.from({ length: 721 }, (_, i) => rimChroma(mode, i / 2));
		const rimAt = (hue: number) => {
			const i = hue * 2;
			const lo = Math.floor(i);
			return rim[lo] + (rim[lo + 1] - rim[lo]) * (i - lo);
		};
		const c = n / 2;
		const outer = c;
		const inner = (SIZE / 2 - RING) * scale;
		const disc = DISC * scale;
		const img = ctx.createImageData(n, n);
		for (let y = 0; y < n; y++) {
			for (let x = 0; x < n; x++) {
				const dx = x + 0.5 - c;
				const dy = c - y - 0.5;
				const dist = Math.hypot(dx, dy);
				const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
				// A pixel's worth of fade at every edge, in place of a hard cut.
				const inDisc = Math.min(1, Math.max(0, disc - dist));
				const inRing = Math.min(1, Math.max(0, Math.min(dist - inner, outer - dist)));
				let rgb: [number, number, number];
				let alpha: number;
				if (inDisc > 0) {
					rgb = oklchToRgb(...backdrop(mode, hue, tintAt(dist / disc)));
					alpha = inDisc;
				} else if (inRing > 0) {
					rgb = oklchToRgb(ringL, rimAt(hue), hue);
					alpha = inRing;
				} else {
					continue;
				}
				img.data.set([...rgb, Math.round(alpha * 255)], (y * n + x) * 4);
			}
		}
		ctx.putImageData(img, 0, 0);
	});

	const angle = (hue: number) => (hue * Math.PI) / 180;
	const onRing = (hue: number): [number, number] => {
		const radius = SIZE / 2 - RING / 2;
		return [SIZE / 2 + radius * Math.cos(angle(hue)), SIZE / 2 - radius * Math.sin(angle(hue))];
	};
	const inDisc = (hue: number, tint: number): [number, number] => [
		SIZE / 2 + reachOf(tint) * TRAVEL * Math.cos(angle(hue)),
		SIZE / 2 - reachOf(tint) * TRAVEL * Math.sin(angle(hue)),
	];

	const refs = $derived([{ link: "accent" as const, title: "Match accent", hue: r.accentHue }]);

	/** The accent's strength as a share of the most its hue can take, kept as the hue turns. */
	const vibrance = $derived(Math.min(1, r.accentChroma / rimChroma(r.mode, r.accentHue)));

	function setAccentHue(hue: number) {
		const keep = vibrance;
		const next = (hue + 360) % 360;
		studio.recipe.accentHue = next;
		studio.recipe.accentChroma = Math.max(0.02, keep * rimChroma(r.mode, next));
		followAccent(studio.recipe);
	}
	function setBackground(hue: number, tint: number, link: "accent" | "opposite" | null = null) {
		studio.recipe.backgroundLink = link;
		studio.recipe.baseHue = (hue + 360) % 360;
		studio.recipe.tint = Math.min(1, Math.max(0, tint));
	}

	// The press decides what the drag moves: on the ring the accent, inside it the background.
	let target: "accent" | "background" = "background";
	function start(e: PointerEvent): boolean {
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const dist = Math.hypot(e.clientX - box.left - SIZE / 2, e.clientY - box.top - SIZE / 2);
		target = dist > DISC + GAP / 2 ? "accent" : "background";
		return true;
	}
	function move(fx: number, fy: number) {
		const x = fx * SIZE;
		const y = fy * SIZE;
		const dx = x - SIZE / 2;
		const dy = SIZE / 2 - y;
		const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
		if (target === "accent") {
			setAccentHue(hue);
			return;
		}
		const near = refs.find((ref) => {
			const [rx, ry] = inDisc(ref.hue, DOT_TINT);
			return Math.hypot(x - rx, y - ry) <= SNAP_PX;
		});
		if (near) {
			setBackground(near.hue, DOT_TINT, near.link);
		} else {
			setBackground(hue, tintAt(Math.hypot(dx, dy) / TRAVEL));
		}
	}

	function onRingKey(e: KeyboardEvent) {
		const step = arrowStep(e);
		if (step) {
			setAccentHue(r.accentHue + (step[0] || -step[1]) * 4);
		}
	}
	function onDiscKey(e: KeyboardEvent) {
		const step = arrowStep(e);
		if (step) {
			setBackground(r.baseHue + step[0] * 4, tintAt(reachOf(r.tint) - step[1] * 0.04));
		}
	}

	let hexDraft = $state<string | null>(null);
	function commitHex() {
		const value = (hexDraft ?? "").trim().replace(/^#?/, "#");
		hexDraft = null;
		if (!/^#[0-9a-f]{6}$/i.test(value)) {
			return;
		}
		const o = hexToOklch(value);
		studio.recipe.accentHue = o.h;
		studio.recipe.accentChroma = Math.min(CHROMA_CEILING, Math.max(0.02, o.C));
		followAccent(studio.recipe);
	}

	const VIBRANCE_WORDS: [number, string][] = [
		[0.2, "muted"],
		[0.4, "soft"],
		[0.65, "balanced"],
		[0.85, "bold"],
		[1.01, "vivid"],
	];
	const vibranceWord = $derived(VIBRANCE_WORDS.find(([upTo]) => vibrance < upTo)?.[1] ?? "vivid");

	const HUE_NAMES: [number, string][] = [
		[12, "rose"],
		[35, "red"],
		[55, "orange"],
		[80, "amber"],
		[105, "yellow"],
		[135, "lime"],
		[165, "green"],
		[195, "teal"],
		[225, "cyan"],
		[250, "blue"],
		[275, "indigo"],
		[300, "violet"],
		[330, "plum"],
		[350, "magenta"],
		[360, "rose"],
	];
	const backgroundWords = $derived.by(() => {
		if (r.tint < 0.05) {
			return "grey";
		}
		const share = `${Math.round(r.tint * 100)}%`;
		if (r.backgroundLink === "accent") {
			return `follows accent · ${share}`;
		}
		if (r.backgroundLink === "opposite") {
			return `opposite accent · ${share}`;
		}
		return `${HUE_NAMES.find(([upTo]) => r.baseHue < upTo)?.[1] ?? "rose"} · ${share}`;
	});

	const vibranceTrack = $derived(
		`linear-gradient(to right, ${oklchToHex(accentLightness(r.mode, r.contrast), 0, r.accentHue)}, ${oklchToHex(accentLightness(r.mode, r.contrast), rimChroma(r.mode, r.accentHue), r.accentHue)})`,
	);
	const buttonText = $derived(
		contrastRatio(g.colours.crust, g.colours.lavender) >= 4.5
			? g.colours.crust
			: contrastRatio("#ffffff", g.colours.lavender) > contrastRatio("#111111", g.colours.lavender)
				? "#ffffff"
				: "#111111",
	);

	const accentHandle = $derived(onRing(r.accentHue));
	const backgroundHandle = $derived(inDisc(r.baseHue, r.tint));
</script>

<div class="top">
	<div class="wheel" style:width="{SIZE}px" style:height="{SIZE}px" use:dragArea={{ move, start }}>
		<canvas bind:this={canvas}></canvas>
		<span class="centre" style:left="{SIZE / 2}px" style:top="{SIZE / 2}px"></span>
		{#each refs as ref (ref.link)}
			{@const at = inDisc(ref.hue, DOT_TINT)}
			<button
				type="button"
				class="ref"
				style:left="{at[0]}px"
				style:top="{at[1]}px"
				title="{ref.title}: a faint wash of its hue, turning with it"
				aria-label="Background: {ref.title.toLowerCase()}"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={() => setBackground(ref.hue, DOT_TINT, ref.link)}
			></button>
		{/each}
		<div
			class="handle background"
			style:left="{backgroundHandle[0]}px"
			style:top="{backgroundHandle[1]}px"
			style:background={oklchToHex(...backdrop(r.mode, r.baseHue, r.tint))}
			role="slider"
			tabindex="0"
			aria-label="Background colour"
			aria-valuenow={Math.round(r.tint * 100)}
			aria-valuetext="Background {backgroundWords}"
			title="Background: drag around for hue, outward for more colour"
			onkeydown={onDiscKey}
		></div>
		<div
			class="handle accent"
			style:left="{accentHandle[0]}px"
			style:top="{accentHandle[1]}px"
			style:background={g.colours.mauve}
			role="slider"
			tabindex="0"
			aria-label="Accent hue"
			aria-valuenow={Math.round(r.accentHue)}
			title="Accent: drag around the ring"
			onkeydown={onRingKey}
		></div>
	</div>

	<div class="side">
		<div class="preview" aria-hidden="true">
			<span
				class="surface side-surface"
				style:background={g.sidebar.bg}
				style:color={g.sidebar.sub}
			>
				<span class="lines">
					<i style:background={g.sidebar.sel}></i>
					<i style:background={g.sidebar.sub}></i>
					<i style:background={g.sidebar.sub}></i>
				</span>
				Sidebar
			</span>
			<span
				class="surface page"
				style:background={g.colours.crust}
				style:color={g.colours.subtext0}
			>
				<span class="button" style:background={g.colours.lavender} style:color={buttonText}
					>Button</span
				>
				Page
			</span>
			<span class="surface" style:background={g.colours.mantle} style:color={g.colours.subtext0}
				>Cards</span
			>
		</div>
		<div class="captions">
			<span>
				Accent <b>{vibranceWord}</b>
				<input
					class="hex"
					spellcheck="false"
					aria-label="Accent hex"
					value={hexDraft ?? g.colours.mauve}
					oninput={(e) => (hexDraft = e.currentTarget.value)}
					onchange={commitHex}
					onkeydown={(e) => e.key === "Enter" && commitHex()}
				/>
			</span>
			<span>Background <b>{backgroundWords}</b></span>
		</div>
	</div>
</div>

<label class="row">
	<span class="row-label">Vibrance</span>
	<span class="vibrance" style:--track={vibranceTrack}>
		<input
			type="range"
			min="0"
			max="100"
			value={Math.round(vibrance * 100)}
			aria-valuetext={vibranceWord}
			oninput={(e) =>
				(studio.recipe.accentChroma = Math.max(
					0.02,
					(Number(e.currentTarget.value) / 100) * rimChroma(r.mode, r.accentHue),
				))}
		/>
	</span>
</label>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: var(--abt-space-5);
	}
	.wheel {
		position: relative;
		flex: none;
		cursor: crosshair;
		touch-action: none;
		user-select: none;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.centre,
	.handle,
	.ref {
		position: absolute;
		border-radius: var(--abt-radius-pill);
		transform: translate(-50%, -50%);
	}
	.centre {
		width: 5px;
		height: 5px;
		background: color-mix(in srgb, white 45%, transparent);
		pointer-events: none;
	}
	.handle {
		border: 2px solid white;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.35),
			0 2px 6px rgba(0, 0, 0, 0.35);
		cursor: grab;
		outline: none;
	}
	.handle:focus-visible {
		box-shadow:
			0 0 0 3px var(--abt-accent),
			0 2px 6px rgba(0, 0, 0, 0.35);
	}
	.handle.accent {
		width: 22px;
		height: 22px;
		border-width: 3px;
	}
	.handle.background {
		width: 16px;
		height: 16px;
	}
	.ref {
		width: 9px;
		height: 9px;
		padding: 0;
		border: 0;
		background: color-mix(in srgb, white 60%, transparent);
		cursor: pointer;
	}
	.ref:hover {
		background: white;
		transform: translate(-50%, -50%) scale(1.25);
	}

	.side {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--abt-space-3);
		min-width: 0;
	}
	/* The real surfaces, big enough to tell apart: they're close to each other by design. */
	.preview {
		display: grid;
		grid-template-columns: 2fr 3fr;
		grid-template-rows: 1fr 1fr;
		height: 96px;
		overflow: hidden;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
	}
	.surface {
		position: relative;
		display: flex;
		align-items: flex-end;
		padding: var(--abt-space-2) var(--abt-space-3);
		font-size: var(--abt-text-sm);
	}
	.side-surface {
		grid-row: 1 / -1;
		flex-direction: column;
		align-items: flex-start;
		justify-content: space-between;
		padding-top: var(--abt-space-3);
	}
	.lines {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}
	.lines i {
		display: block;
		width: 60%;
		height: 3px;
		border-radius: var(--abt-radius-pill);
		opacity: 0.5;
	}
	.lines i:first-child {
		width: 85%;
		opacity: 1;
	}
	.button {
		position: absolute;
		top: var(--abt-space-2);
		right: var(--abt-space-2);
		padding: 1px var(--abt-space-3);
		border-radius: var(--abt-radius-sm);
		font-size: var(--abt-text-xs);
		font-weight: 600;
	}
	.captions {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.captions b {
		color: var(--abt-ink);
		font-weight: 600;
	}
	/* Reads as part of the caption until clicked. */
	.hex {
		width: 64px;
		margin-left: var(--abt-space-2);
		padding: 0 var(--abt-space-1);
		border: 1px solid transparent;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-soft);
		font:
			var(--abt-text-sm) ui-monospace,
			"SF Mono",
			Menlo,
			monospace;
	}
	.hex:hover,
	.hex:focus {
		border-color: var(--abt-line);
		color: var(--abt-ink);
		outline: none;
	}

	.row {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		align-items: center;
		gap: var(--abt-space-3);
	}
	.row-label {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	/* Grey to the accent at full strength, under a range input with only its thumb drawn. */
	.vibrance {
		display: block;
		height: 18px;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		background: var(--track);
	}
	.vibrance input {
		width: 100%;
		height: 100%;
		margin: 0;
		background: none;
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}
	.vibrance input::-webkit-slider-runnable-track {
		height: 100%;
		background: none;
	}
	.vibrance input::-moz-range-track {
		background: none;
	}
	.vibrance input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 6px;
		height: 22px;
		margin-top: -3px;
		border: 2px solid white;
		border-radius: var(--abt-radius-sm);
		background: transparent;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
	}
	.vibrance input::-moz-range-thumb {
		width: 4px;
		height: 20px;
		border: 2px solid white;
		border-radius: var(--abt-radius-sm);
		background: transparent;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
	}
</style>
