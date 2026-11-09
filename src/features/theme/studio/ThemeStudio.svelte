<script lang="ts">
	import Badge from "@lib/components/panel/Badge.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import Switch from "@lib/components/Switch.svelte";
	import { Moon, Shuffle, Sun } from "@lucide/svelte";
	import { onMount } from "svelte";
	import AccentHex from "./AccentHex.svelte";
	import { previewRecipe } from "./apply";
	import ColorWheel from "./ColorWheel.svelte";
	import {
		contrastReport,
		contrastToPass,
		generate,
		oklchToHex,
		accentLightness,
		LIFT_RANGE,
		readableLift,
		familyHues,
		type BudgetTone,
		type Family,
		type SidebarStyle,
	} from "./generator";
	import GlowMap from "./GlowMap.svelte";
	import GrainControl from "./GrainControl.svelte";
	import MiniTheme from "./MiniTheme.svelte";
	import Rail from "./Rail.svelte";
	import { copyRecipe, PRESETS, shuffleRecipe } from "./recipes";
	import { remember, studio } from "./state.svelte";

	const r = $derived(studio.recipe);
	const g = $derived(generate(studio.recipe));
	const contrast = $derived(contrastReport(g));
	const restL = $derived(accentLightness(r.mode, r.contrast));
	const liftTrack = $derived(
		`linear-gradient(to right, ${oklchToHex(restL + LIFT_RANGE[0], r.accentChroma, r.accentHue)}, ${oklchToHex(restL + LIFT_RANGE[1], r.accentChroma, r.accentHue)})`,
	);
	const presets = PRESETS.map((p) => ({ recipe: p, g: generate(p) }));
	const recent = $derived(studio.recent.map((recipe) => ({ recipe, g: generate(recipe) })));

	$effect(() => {
		previewRecipe(studio.recipe, g);
	});

	function shuffle() {
		const next = shuffleRecipe(studio.recipe);
		studio.recipe = next;
		studio.light = 0;
		remember(next);
	}
	function load(recipe: typeof studio.recipe) {
		studio.recipe = copyRecipe(recipe);
		studio.light = 0;
	}

	// Space shuffles, unless something that takes typing or its own Space has focus.
	onMount(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement | null;
			if (
				e.key !== " " ||
				e.repeat ||
				e.metaKey ||
				e.ctrlKey ||
				e.altKey ||
				el?.closest("input, textarea, select, button, [contenteditable], [role='slider']") // raw: the panel's own controls
			) {
				return;
			}
			e.preventDefault();
			shuffle();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	});

	const SIDEBARS: [SidebarStyle, string][] = $derived([
		["match", "Match"],
		["deeper", "Deeper"],
		["dark", r.mode === "dark" ? "Black" : "Dark"],
		["tinted", "Tinted"],
	]);
	const FAMILIES: [Family, string, string][] = [
		["close", "Similar", "Hues near the accent"],
		["opposite", "Opposite", "Hues across the wheel from the accent"],
		["rainbow", "Rainbow", "Hues spread evenly round the wheel"],
		["custom", "Custom", "Pick the links' hue yourself"],
	];
	// Custom starts from the hue the links have now, so choosing it changes nothing yet.
	function pickFamily(value: Family) {
		if (value === "custom" && studio.recipe.family !== "custom") {
			studio.recipe.linkHue = Math.round(familyHues(studio.recipe)[0]);
		}
		studio.recipe.family = value;
	}
	const hueTrack = $derived(
		`linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) =>
			oklchToHex(accentLightness(r.mode, 0.5), 0.12, i * 30),
		).join(", ")})`,
	);
	// What this setting picks.
	const FAMILY_STRIP: [string, string][] = [
		["blue", "Links"],
		["sapphire", "Second color (glow)"],
		["sky", "Light links"],
		["teal", "Notices"],
	];
	// Actual's chart colors, in the order charts use them (theme-apply's chartQual1-9).
	const CHART_STRIP: [string, string][] = [
		["teal", "Notices"],
		["yellow", "Warning"],
		["peach", "Caution"],
		["red", "Overspent"],
		["blue", "Links"],
		["pink", "Accent light"],
		["green", "Funded"],
		["mauve", "Accent"],
		["rosewater", "Accent pale"],
	];
	const BUDGET_TONES: [BudgetTone, string][] = [
		["vivid", "Vivid"],
		["muted", "Muted"],
	];
	const budgetSamples = $derived(
		BUDGET_TONES.map(([tone, label]) => ({
			tone,
			label,
			c: generate({ ...studio.recipe, budget: tone }).colors,
		})),
	);

	const PALETTE_GROUPS: [string, [string, string][]][] = [
		[
			"Text",
			[
				["text", "Text"],
				["subtext1", "Secondary text"],
				["subtext0", "Subtle text"],
				["overlay2", "Muted, strong"],
				["overlay1", "Budgeted amounts"],
				["overlay0", "Muted text"],
			],
		],
		[
			"Surfaces",
			[
				["crust", "Page"],
				["mantle", "Cards"],
				["base", "Hover"],
				["surface0", "Inputs and borders"],
				["surface1", "Raised"],
				["surface2", "Raised, strong"],
			],
		],
		[
			"Accent",
			[
				["mauve", "Accent"],
				["lavender", "Primary button"],
				["pink", "Accent light"],
				["flamingo", "Accent lighter"],
				["rosewater", "Accent pale"],
			],
		],
		[
			"Links and charts",
			[
				["blue", "Links"],
				["sapphire", "Second color (glow)"],
				["sky", "Light links"],
				["teal", "Notices"],
			],
		],
		[
			"Budget status",
			[
				["green", "Funded"],
				["red", "Overspent"],
				["maroon", "Overspent, deep"],
				["peach", "Caution"],
				["yellow", "Warning"],
			],
		],
	];
	const PALETTE_COUNT = PALETTE_GROUPS.reduce((n, [, roles]) => n + roles.length, 0);
</script>

<div class="studio">
	<div class="start">
		<input class="abt-input name" bind:value={studio.recipe.name} aria-label="Theme name" />

		<div class="presets">
			{#each presets as p (p.recipe.name)}
				<button
					type="button"
					class="preset"
					title="Start from {p.recipe.name}"
					onclick={() => load(p.recipe)}
				>
					<MiniTheme g={p.g} />
					<span>{p.recipe.name}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="shuffle-row">
		<button type="button" class="abt-btn shuffle" title="Shuffle (Space)" onclick={shuffle}>
			<Shuffle size={14} strokeWidth={2} /> Shuffle
		</button>
		{#each recent as item, i (i)}
			<button
				type="button"
				class="recent-dot"
				style:--dot-page={item.g.colors.crust}
				style:--dot-accent={item.g.colors.mauve}
				title="Back to {item.recipe.name}"
				aria-label="Back to {item.recipe.name}"
				onclick={() => load(item.recipe)}
			></button>
		{/each}
	</div>

	<div class="sections">
		<Section card={false} muted title="Color" collapsible={false} privateTrailing={false}>
			{#snippet trailing()}<AccentHex hex={g.colors.mauve} />{/snippet}
			<div class="stack">
				<div class="abt-seg stretch" role="group" aria-label="Mode">
					<button
						type="button"
						aria-pressed={r.mode === "light"}
						onclick={() => (studio.recipe.mode = "light")}
					>
						<Sun size={14} strokeWidth={2} /> Light
					</button>
					<button
						type="button"
						aria-pressed={r.mode === "dark"}
						onclick={() => (studio.recipe.mode = "dark")}
					>
						<Moon size={14} strokeWidth={2} /> Dark
					</button>
				</div>
				<ColorWheel {g} />
			</div>
		</Section>

		<Section card={false} muted title="Glow" collapsible={false} privateTrailing={false}>
			{#snippet trailing()}
				<!-- A label, so a click anywhere on the switch reaches its checkbox. -->
				<label class="switch" aria-label="Glow">
					<Switch
						checked={r.glow.on}
						onCheckedChange={(on) => {
							studio.recipe.glow.on = on;
							if (on && !studio.recipe.glow.lights.length) {
								studio.recipe.glow.lights.push({
									x: 0,
									y: 0,
									size: 0.55,
									strength: 50,
									color: "accent",
								});
							}
						}}
					/>
				</label>
			{/snippet}
			<div class="stack">
				<GlowMap {g} />
			</div>
		</Section>

		<Section card={false} muted title="Grain" collapsible={false}>
			<div class="stack">
				<GrainControl {g} />
			</div>
		</Section>
		<div class="details">
			<Section
				card={false}
				muted
				caps={false}
				title="Contrast"
				open={false}
				privateTrailing={false}
			>
				{#snippet trailing()}
					<Badge tone={contrast.passes ? "positive" : "negative"}>
						{contrast.passes ? "Passes AA" : `${contrast.failing.length} below AA`}
					</Badge>
				{/snippet}
				<div class="stack">
					<div class="contrast">
						<span class="aa soft" style:color={g.colors.subtext0} title="Soft">Aa</span>
						<input
							type="range"
							min="0"
							max="100"
							value={Math.round(r.contrast * 100)}
							aria-label="Contrast"
							oninput={(e) => (studio.recipe.contrast = Number(e.currentTarget.value) / 100)}
						/>
						<span class="aa crisp" title="Crisp">Aa</span>
					</div>
					<!-- Only what needs attention: nothing to read while everything passes. -->
					{#if !contrast.passes}
						<ul class="checks">
							{#each contrast.failing as check (check.label)}
								<li>
									<span class="sample" style:color={check.fg} style:background={check.bg}>Aa</span>
									<span class="check-label">{check.label}</span>
									<span class="ratio"><b>{check.ratio.toFixed(1)}</b> / {check.min}:1</span>
								</li>
							{/each}
						</ul>
						<button
							type="button"
							class="abt-btn abt-btn--sm"
							onclick={() => (studio.recipe.contrast = contrastToPass(studio.recipe))}
							>Fix contrast</button
						>
					{/if}
				</div>
			</Section>

			<Section card={false} muted caps={false} title="Advanced" open={false}>
				<div class="stack">
					<div class="sub">
						<span class="sub-label">Sidebar</span>
						<div class="abt-seg abt-seg--sm stretch" role="group" aria-label="Sidebar">
							{#each SIDEBARS as [value, label] (value)}
								<button
									type="button"
									aria-pressed={r.sidebar === value}
									onclick={() => (studio.recipe.sidebar = value)}>{label}</button
								>
							{/each}
						</div>
					</div>

					<div class="sub">
						<span class="sub-label">Budget colors</span>
						<div class="budget-tones">
							{#each budgetSamples as s (s.tone)}
								<button
									type="button"
									class="tone"
									aria-pressed={r.budget === s.tone}
									onclick={() => (studio.recipe.budget = s.tone)}
								>
									<span class="pills" style:background={s.c.mantle}>
										<span style:color={s.c.green}>117.84</span>
										<span
											style:color={s.c.red}
											style:background="color-mix(in srgb, {s.c.red} 15%, transparent)">-38.40</span
										>
										<span style:color={s.c.yellow}>2.00</span>
									</span>
									{s.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="sub">
						<span class="sub-label">Link and chart colors</span>
						<div
							class="abt-seg abt-seg--sm stretch"
							role="group"
							aria-label="Link and chart colors"
						>
							{#each FAMILIES as [value, label, title] (value)}
								<button
									type="button"
									aria-pressed={r.family === value}
									{title}
									onclick={() => pickFamily(value)}>{label}</button
								>
							{/each}
						</div>
						{#if r.family === "custom"}
							<input
								class="hue"
								type="range"
								min="0"
								max="359"
								value={Math.round(r.linkHue ?? 0)}
								style:--track={hueTrack}
								aria-label="Link hue"
								oninput={(e) => (studio.recipe.linkHue = Number(e.currentTarget.value))}
							/>
						{/if}
						<div class="strip-row">
							<span class="strip-label">This setting</span>
							<div class="strip">
								{#each FAMILY_STRIP as [key, label] (key)}
									<span style:background={g.colors[key]} title="{label} {g.colors[key]}"></span>
								{/each}
							</div>
						</div>
						<div class="strip-row">
							<span class="strip-label">Charts</span>
							<div class="strip">
								{#each CHART_STRIP as [key, label], i (i)}
									<span style:background={g.colors[key]} title="{i + 1}. {label} {g.colors[key]}"
									></span>
								{/each}
							</div>
						</div>
						<span class="note"
							>Links, menu headers and notices use the first row. Charts take their colors in the
							order of the second, which mixes in the budget and accent colors.</span
						>
					</div>

					<div class="sub">
						<span class="sub-label">Accent</span>
						<!-- Hatched where the accent would be too hard to read on these backgrounds. -->
						<Rail
							label="Brightness"
							track={liftTrack}
							min={LIFT_RANGE[0]}
							max={LIFT_RANGE[1]}
							value={r.accentLift ?? 0}
							allowed={readableLift(r, g.colors)}
							blockedReason="Too hard to read: below 4.5:1 against the page, cards or hover rows"
							onchange={(v) => (studio.recipe.accentLift = v)}
						/>
					</div>

					<div class="sub">
						<span class="sub-label">All {PALETTE_COUNT} colors</span>
						{#each PALETTE_GROUPS as [group, roles] (group)}
							<div class="palette-group">
								<span class="strip-label">{group}</span>
								<div class="palette">
									{#each roles as [key, label] (key)}
										<span class="color" title={g.colors[key]}>
											<i style:background={g.colors[key]}></i>{label}
										</span>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</Section>
		</div>
	</div>
</div>

<style>
	/* Blocks (start, shuffle, the controls) sit further apart than the rows within them. */
	.studio {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-6);
		/* No side padding: sections bring their own, as in ABT's other panels. */
		padding: var(--abt-space-4) 0 var(--abt-space-6);
		color: var(--abt-ink);
		font-size: var(--abt-text-base);
		overflow-y: auto;
	}
	.start,
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
		min-width: 0;
	}
	.start,
	.shuffle-row,
	.stack {
		padding: 0 12px; /* raw: matches panel Section's gutter */
	}
	.stack {
		padding-top: var(--abt-space-2);
	}
	/* Open controls well apart; the collapsed rows below sit as a closer list. */
	.sections :global(.section + .section) {
		margin-top: var(--abt-space-6);
	}
	.details {
		margin-top: var(--abt-space-6);
	}
	.details :global(.section + .section) {
		margin-top: var(--abt-space-2);
	}
	/* An open row's controls end in clear space and a rule, so the next row reads as its own. */
	.details :global(.section[data-open="true"]:not(:last-child)) {
		padding-bottom: 20px; /* raw: a block's worth of space */
		border-bottom: 1px solid var(--abt-line);
	}
	.switch {
		display: flex;
		cursor: pointer;
	}
	.stretch {
		display: flex;
	}
	.stretch > button {
		flex: 1;
		justify-content: center;
	}

	.name {
		font-weight: 600;
	}
	.shuffle-row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.shuffle {
		flex: 1;
		justify-content: center;
	}
	/* Recent shuffles: the theme's page color beside its accent. */
	.recent-dot {
		flex: none;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-pill);
		background: linear-gradient(90deg, var(--dot-page) 50%, var(--dot-accent) 50%);
		cursor: pointer;
	}
	.recent-dot:hover {
		outline: 2px solid var(--abt-ink-4);
		outline-offset: 1px;
	}

	.presets {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: var(--abt-space-2);
	}
	.preset,
	.tone {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		min-width: 0;
		padding: var(--abt-space-1);
		border: 1px solid transparent;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-soft);
		font: inherit;
		font-size: var(--abt-text-xs);
		cursor: pointer;
	}
	.preset:hover,
	.tone:hover {
		background: var(--abt-ink-2);
		color: var(--abt-ink);
	}
	.preset span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.budget-tones {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--abt-space-3);
	}
	.tone {
		align-items: stretch;
		padding: var(--abt-space-2);
		font-size: var(--abt-text-sm);
		text-align: center;
	}
	.tone[aria-pressed="true"] {
		border-color: var(--abt-accent-4);
		background: var(--abt-accent-1);
		color: var(--abt-accent-text);
		font-weight: 600;
	}
	.pills {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		padding: var(--abt-space-3) var(--abt-space-2);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.pills span {
		padding: 0 var(--abt-space-3);
		border-radius: var(--abt-radius-pill);
	}

	.contrast {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.contrast input {
		width: 100%;
		accent-color: var(--abt-accent);
	}
	.aa {
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}
	.crisp {
		color: var(--abt-ink);
	}
	.ratio b {
		color: var(--abt-ink);
		font-weight: 600;
	}
	.checks {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		margin: 0 0 var(--abt-space-2);
		padding: 0;
		list-style: none;
		font-size: var(--abt-text-sm);
	}
	.checks li {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
	}
	.sample {
		padding: 1px 6px;
		border-radius: var(--abt-radius-sm);
		border: 1px solid var(--abt-line);
		font-weight: 600;
	}
	.check-label {
		flex: 1;
		color: var(--abt-ink);
	}
	.ratio {
		color: var(--abt-soft);
		font-variant-numeric: tabular-nums;
	}

	/* A hue rail at the links' own lightness. */
	.hue {
		width: 100%;
		height: 14px;
		margin: 0;
		border-radius: var(--abt-radius-pill);
		background: var(--track);
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}
	.hue::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border: 2px solid white;
		border-radius: var(--abt-radius-pill);
		background: transparent;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
	}
	.hue::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border: 2px solid white;
		border-radius: var(--abt-radius-pill);
		background: transparent;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
	}
	.strip {
		display: flex;
		height: 22px;
		overflow: hidden;
		border-radius: var(--abt-radius-sm);
	}
	.strip span {
		flex: 1;
	}
	/* A group inside Advanced: its own small heading over its controls. */
	.sub {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
	}
	.sub + .sub {
		padding-top: var(--abt-space-5);
		border-top: 1px solid var(--abt-line);
	}
	.sub-label {
		font-size: var(--abt-text-sm);
		font-weight: 600;
		color: var(--abt-ink);
	}
	.strip-row,
	.palette-group {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}
	.strip-label {
		font-size: var(--abt-text-xs);
		font-weight: 600;
		color: var(--abt-soft);
	}
	.note {
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
	}
	.palette {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--abt-space-2) var(--abt-space-4);
	}
	.color {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		min-width: 0;
		font-size: var(--abt-text-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.color i {
		flex: none;
		width: 14px;
		height: 14px;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
	}
</style>
