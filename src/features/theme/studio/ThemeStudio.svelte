<script lang="ts">
	import Badge from "@lib/components/panel/Badge.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import Switch from "@lib/components/Switch.svelte";
	import { Dices, Lock, LockOpen, Moon, Shuffle, Sun } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { previewRecipe } from "./apply";
	import ColourWheel from "./ColourWheel.svelte";
	import {
		contrastReport,
		contrastToPass,
		generate,
		grainImage,
		lightColour,
		oklchToHex,
		type BudgetTone,
		type Family,
		type SidebarStyle,
	} from "./generator";
	import GlowMap from "./GlowMap.svelte";
	import GrainControl from "./GrainControl.svelte";
	import MiniTheme from "./MiniTheme.svelte";
	import { type PreviewState, setPreviewState } from "./preview-states";
	import { copyRecipe, PRESETS, rerollTrait, shuffleRecipe, type Trait, TRAITS } from "./recipes";
	import { remember, studio } from "./state.svelte";

	const r = $derived(studio.recipe);
	const g = $derived(generate(studio.recipe));
	const contrast = $derived(contrastReport(g));
	const weakest = $derived(
		contrast.checks.reduce((a, b) => (b.ratio / b.min < a.ratio / a.min ? b : a)),
	);
	const presets = PRESETS.map((p) => ({ recipe: p, g: generate(p) }));
	const recent = $derived(studio.recent.map((recipe) => ({ recipe, g: generate(recipe) })));

	$effect(() => {
		previewRecipe(studio.recipe, g);
	});
	$effect(() => {
		setPreviewState(studio.preview);
	});

	function shuffle() {
		const next = shuffleRecipe(studio.recipe, studio.locks);
		studio.recipe = next;
		studio.light = 0;
		remember(next);
	}
	function reroll(trait: Trait) {
		const next = rerollTrait(studio.recipe, trait);
		studio.recipe = next;
		if (trait === "glow") {
			studio.light = 0;
		}
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

	const PREVIEWS: [PreviewState, string][] = [
		["healthy", "Healthy"],
		["overspent", "Overspent"],
		["privacy", "Privacy"],
	];
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
	];
	// The accent, then the four colours this setting chooses.
	const STRIP: [string, string][] = [
		["mauve", "Accent"],
		["blue", "Links"],
		["sapphire", "Second colour"],
		["sky", "Third colour"],
		["teal", "Fourth colour"],
	];
	const BUDGET_TONES: [BudgetTone, string][] = [
		["vivid", "Vivid"],
		["muted", "Muted"],
	];
	const budgetSamples = $derived(
		BUDGET_TONES.map(([tone, label]) => ({
			tone,
			label,
			c: generate({ ...studio.recipe, budget: tone }).colours,
		})),
	);

	function swatch(trait: Trait): string {
		switch (trait) {
			case "mode":
				return g.colours.mantle;
			case "background":
				return oklchToHex(r.mode === "dark" ? 0.4 : 0.85, 0.01 + r.tint * 0.08, r.baseHue);
			case "accent":
				return g.colours.mauve;
			case "palette":
				return `linear-gradient(90deg, ${g.colours.blue} 33%, ${g.colours.green} 33% 66%, ${g.colours.red} 66%)`;
			case "glow":
				return r.glow.on && r.glow.lights[0]
					? `radial-gradient(circle, ${lightColour(r.glow.lights[0], g.colours)}, ${g.colours.crust})`
					: g.colours.crust;
			case "grain":
				return r.grain.amount
					? `${grainImage(Math.max(40, r.grain.amount), r.grain.size)}, ${g.colours.surface1}`
					: g.colours.crust;
		}
	}

	const PALETTE_ROLES: [string, string][] = [
		["text", "Text"],
		["subtext1", "Secondary text"],
		["subtext0", "Subtle text"],
		["overlay2", "Overlay strong"],
		["overlay1", "Overlay medium"],
		["overlay0", "Overlay subtle"],
		["surface2", "Surface raised"],
		["surface1", "Surface"],
		["surface0", "Borders"],
		["base", "Hover"],
		["mantle", "Cards"],
		["crust", "Page"],
		["mauve", "Accent"],
		["lavender", "Primary button"],
		["pink", "Accent light"],
		["flamingo", "Accent lighter"],
		["rosewater", "Accent pale"],
		["blue", "Links"],
		["sapphire", "Second colour"],
		["sky", "Third colour"],
		["teal", "Fourth colour"],
		["green", "Funded"],
		["red", "Overspent"],
		["maroon", "Overspent, deep"],
		["peach", "Caution"],
		["yellow", "Warning"],
	];
</script>

<div class="studio">
	<div class="start">
		<div class="abt-seg abt-seg--sm stretch" role="group" aria-label="Preview as">
			<span class="abt-seg__label">Preview as</span>
			{#each PREVIEWS as [value, label] (value)}
				<button
					type="button"
					aria-pressed={studio.preview === value}
					onclick={() => (studio.preview = value)}>{label}</button
				>
			{/each}
		</div>

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

	<div class="shuffle-block">
		<div class="shuffle-row">
			<button
				type="button"
				class="abt-btn shuffle"
				title="Shuffle the unlocked traits (Space)"
				onclick={shuffle}
			>
				<Shuffle size={14} strokeWidth={2} /> Shuffle
			</button>
			{#each recent as item, i (i)}
				<button
					type="button"
					class="recent-dot"
					style:--dot-page={item.g.colours.crust}
					style:--dot-accent={item.g.colours.mauve}
					title="Back to {item.recipe.name}"
					aria-label="Back to {item.recipe.name}"
					onclick={() => load(item.recipe)}
				></button>
			{/each}
		</div>
		<div class="traits" role="group" aria-label="Locked when shuffling">
			{#each TRAITS as t (t.trait)}
				<span class="chip" class:locked={studio.locks[t.trait]}>
					<button
						type="button"
						class="reroll"
						title="Shuffle only {t.label.toLowerCase()}"
						aria-label="Shuffle only {t.label.toLowerCase()}"
						onclick={() => reroll(t.trait)}
					>
						<span class="trait-swatch" style:background={swatch(t.trait)}></span>
						<span class="dice"><Dices size={13} strokeWidth={2} /></span>
					</button>
					<button
						type="button"
						class="trait"
						aria-pressed={studio.locks[t.trait]}
						title="{t.title}: {studio.locks[t.trait]
							? 'kept when shuffling'
							: 'click to keep when shuffling'}"
						onclick={() => (studio.locks[t.trait] = !studio.locks[t.trait])}
					>
						{t.label}
						<span class="trait-lock">
							{#if studio.locks[t.trait]}
								<Lock size={11} strokeWidth={2.4} />
							{:else}
								<LockOpen size={11} strokeWidth={2} />
							{/if}
						</span>
					</button>
				</span>
			{/each}
		</div>
	</div>

	<div class="sections">
		<Section card={false} muted title="Colour" collapsible={false}>
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
				<ColourWheel {g} />
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
									colour: "accent",
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
			<Section card={false} muted title="Budget colours" open={false} privateTrailing={false}>
				{#snippet trailing()}{r.budget === "vivid" ? "Vivid" : "Muted"}{/snippet}
				<div class="stack">
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
			</Section>

			<Section
				card={false}
				muted
				title="Link and chart colours"
				open={false}
				privateTrailing={false}
			>
				{#snippet trailing()}{FAMILIES.find(([v]) => v === r.family)?.[1]}{/snippet}
				<div class="stack">
					<div class="abt-seg abt-seg--sm stretch" role="group" aria-label="Link and chart colours">
						{#each FAMILIES as [value, label, title] (value)}
							<button
								type="button"
								aria-pressed={r.family === value}
								{title}
								onclick={() => (studio.recipe.family = value)}>{label}</button
							>
						{/each}
					</div>
					<div class="strip">
						{#each STRIP as [key, label] (key)}
							<span style:background={g.colours[key]} title="{label} {g.colours[key]}"></span>
						{/each}
					</div>
					<span class="note"
						>Links, focused inputs, menu highlights, notices and report charts.</span
					>
				</div>
			</Section>

			<Section card={false} muted title="Contrast" open={false} privateTrailing={false}>
				{#snippet trailing()}
					<Badge tone={contrast.passes ? "positive" : "negative"}>
						{contrast.passes ? "Passes AA" : `${contrast.failing.length} below AA`}
					</Badge>
				{/snippet}
				<div class="stack">
					<div class="contrast">
						<span class="aa soft" style:color={g.colours.subtext0} title="Soft">Aa</span>
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
					{#if contrast.passes}
						<p class="ratios">
							All {contrast.checks.length} text colours pass. Lowest:
							<b>{weakest.label} {weakest.ratio.toFixed(1)}:1</b>
						</p>
					{:else}
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

			<Section card={false} muted title="Sidebar" open={false} privateTrailing={false}>
				{#snippet trailing()}{SIDEBARS.find(([v]) => v === r.sidebar)?.[1]}{/snippet}
				<div class="stack">
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
			</Section>

			<Section card={false} muted title="Advanced" open={false} privateTrailing={false}>
				{#snippet trailing()}{PALETTE_ROLES.length} colours{/snippet}
				<div class="stack">
					<div class="palette">
						{#each PALETTE_ROLES as [key, label] (key)}
							<span class="colour" title={g.colours[key]}>
								<i style:background={g.colours[key]}></i>{label}
							</span>
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
	.shuffle-block,
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
	.shuffle-block {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
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
	/* Recent shuffles: the theme's page colour beside its accent. */
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

	.traits {
		display: flex;
		flex-wrap: wrap;
		gap: var(--abt-space-1) var(--abt-space-2);
	}
	/* Plain until locked: only a locked trait gets a fill, a border and its lock. */
	.chip {
		display: inline-flex;
		align-items: center;
		height: 24px;
		padding: 0 var(--abt-space-1);
		border: 1px solid transparent;
		border-radius: var(--abt-radius-pill);
		color: var(--abt-muted);
	}
	.chip:hover,
	.chip:focus-within {
		background: var(--abt-ink-2);
		color: var(--abt-ink);
	}
	.chip.locked {
		border-color: var(--abt-accent-4);
		background: var(--abt-accent-2);
		color: var(--abt-accent-text);
	}
	.chip button {
		display: inline-flex;
		align-items: center;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-size: var(--abt-text-sm);
		cursor: pointer;
	}
	.trait {
		gap: var(--abt-space-2);
		padding: 0 var(--abt-space-2) 0 var(--abt-space-1) !important;
	}
	/* The swatch turns into a dice on hover, so showing it doesn't widen the chip. */
	.reroll {
		justify-content: center;
		width: 18px;
		border-radius: var(--abt-radius-pill) !important;
	}
	.reroll:hover {
		color: var(--abt-accent-text);
	}
	.dice,
	.chip:hover .trait-swatch,
	.chip:focus-within .trait-swatch {
		display: none;
	}
	.chip:hover .dice,
	.chip:focus-within .dice {
		display: inline-flex;
	}
	.trait-lock {
		display: none;
	}
	.chip:hover .trait-lock,
	.chip:focus-within .trait-lock,
	.chip.locked .trait-lock {
		display: inline-flex;
	}
	.trait-swatch {
		width: 12px;
		height: 12px;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-pill);
		background-size: cover;
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
	.ratios {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--abt-space-2) var(--abt-space-4);
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
		font-variant-numeric: tabular-nums;
	}
	.ratios {
		margin: 0;
	}
	.ratios b,
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

	.strip {
		display: flex;
		height: 22px;
		overflow: hidden;
		border-radius: var(--abt-radius-sm);
	}
	.strip span {
		flex: 1;
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
	.colour {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		min-width: 0;
		font-size: var(--abt-text-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.colour i {
		flex: none;
		width: 14px;
		height: 14px;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
	}
</style>
