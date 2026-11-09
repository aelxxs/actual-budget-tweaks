<script lang="ts">
	import { arrowStep, dragArea } from "./drag";
	import {
		accentLightness,
		DEPTH_RANGE,
		type Generated,
		type Mode,
		oklchToHex,
		oklchToRgb,
		rimChroma,
	} from "./generator";
	import { followAccent } from "./recipes";
	import Rail from "./Rail.svelte";
	import { studio } from "./state.svelte";

	const { g }: { g: Generated } = $props();

	/*
	 * One wheel for both colors: the ring picks the accent's hue, the disc inside it the
	 * background's hue and tint. How strong the accent is lives on the Vibrance slider.
	 */
	// The page beside the panel is the preview, so the wheel takes the width.
	const SIZE = 208;
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
	// A faint wash of the accent: matching it at any stronger tint colors the whole page.
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
	const depthRange = $derived(DEPTH_RANGE[r.mode]);
	// The cards' lightness at each end, in the background's own hue and tint.
	const depthTrack = $derived.by(() => {
		const cardL = r.mode === "dark" ? 0.19 - 0.022 * r.contrast : 0.965 - 0.012 * r.tint;
		const C = 0.004 + 0.03 * r.tint;
		return `linear-gradient(to right, ${oklchToHex(cardL + depthRange[0], C, r.baseHue)}, ${oklchToHex(cardL + depthRange[1], C, r.baseHue)})`;
	});

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
			aria-label="Background color"
			aria-valuenow={Math.round(r.tint * 100)}
			aria-valuetext="Background {backgroundWords}"
			title="Background: drag around for hue, outward for more color"
			onkeydown={onDiscKey}
		></div>
		<div
			class="handle accent"
			style:left="{accentHandle[0]}px"
			style:top="{accentHandle[1]}px"
			style:background={g.colors.mauve}
			role="slider"
			tabindex="0"
			aria-label="Accent hue"
			aria-valuenow={Math.round(r.accentHue)}
			title="Accent: drag around the ring"
			onkeydown={onRingKey}
		></div>
	</div>
</div>

<Rail
	label="Vibrance"
	track={vibranceTrack}
	min={0}
	max={1}
	value={vibrance}
	valuetext={vibranceWord}
	onchange={(v) =>
		(studio.recipe.accentChroma = Math.max(0.02, v * rimChroma(r.mode, r.accentHue)))}
/>
<Rail
	label="Shade"
	ariaLabel="Background shade"
	track={depthTrack}
	min={depthRange[0]}
	max={depthRange[1]}
	value={r.depth ?? 0}
	onchange={(v) => (studio.recipe.depth = v)}
/>

<style>
	.top {
		display: flex;
		justify-content: center;
		padding: var(--abt-space-2) 0;
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
</style>
