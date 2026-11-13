<script lang="ts">
	import { styleSettings } from "@features/index";
	import { untrack } from "svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import SettingRow from "@lib/components/SettingRow.svelte";
	import Switch from "@lib/components/Switch.svelte";
	import { editorState } from "../editor-state.svelte";
	import { effectsFor, loadThemeEffects, setThemeEffects } from "../effects-store.svelte";
	import { applyThemeEffects, pageMode } from "../theme-apply";
	import type { Effects, Generated, Mode } from "../studio/generator";
	import GlowMap from "../studio/GlowMap.svelte";
	import GrainControl from "../studio/GrainControl.svelte";
	import { openThemeStudio } from "../studio/open";
	import { studio } from "../studio/state.svelte";
	import { isUserTheme, userThemeState } from "../user-themes.svelte";

	/** Style that applies under every theme. Theme Studio shows it without glow and grain, which it edits per theme. */
	const { inStudio = false }: { inStudio?: boolean } = $props();

	const SURFACE_KEYS = new Set(["border-radius", "background-pattern"]);
	const surfaces = $derived(styleSettings.filter((s) => SURFACE_KEYS.has(s.context.key)));
	const details = $derived(styleSettings.filter((s) => !SURFACE_KEYS.has(s.context.key)));

	// A Studio theme's glow and grain are part of its recipe, edited in the Studio.
	const studioTheme = $derived(
		isUserTheme(editorState.activeTheme) &&
			!!userThemeState.themes[editorState.activeTheme]?.recipe,
	);

	// The glow map draws the app in the colors on screen, whatever the theme.
	const css = (name: string) => `var(--color-${name})`;
	const onScreen = {
		colors: {
			crust: css("pageBackground"),
			mantle: css("tableBackground"),
			overlay0: css("tableBorder"),
			yellow: css("warningText"),
			mauve: "var(--abt-accent)",
			sapphire: css("pageTextLink"),
		},
		sidebar: {
			bg: css("sidebarBackground"),
			sub: css("sidebarItemText"),
			sel: css("sidebarItemAccentSelected"),
		},
	} as unknown as Generated;

	// The theme in use's glow and grain, edited here and painted as they change.
	let editing = $state<{ key: string; target: Effects & { mode: Mode } } | null>(null);
	$effect(() => {
		const key = editorState.activeTheme;
		if (studioTheme) {
			editing = null;
			return;
		}
		void loadThemeEffects().then(() => {
			const saved: Effects = JSON.parse(JSON.stringify(effectsFor(key)));
			studio.light = 0;
			editing = { key, target: { ...saved, mode: pageMode() } };
		});
	});
	$effect(() => {
		if (!editing) {
			return;
		}
		const { key, target } = editing;
		// Read in full, so a change anywhere in the glow or grain runs this again.
		const next = JSON.stringify({ glow: target.glow, grain: target.grain });
		// Saving updates the stored effects, which this mustn't follow, or it would run again.
		untrack(() => {
			if (next === JSON.stringify(effectsFor(key))) {
				return;
			}
			setThemeEffects(key, JSON.parse(next));
			void applyThemeEffects(key);
		});
	});

	function setGlow(on: boolean) {
		if (!editing) {
			return;
		}
		editing.target.glow.on = on;
		if (on && !editing.target.glow.lights.length) {
			editing.target.glow.lights.push({ x: 0, y: 0, size: 0.55, strength: 50, color: "accent" });
		}
	}
</script>

{#if inStudio}
	<Section card={false} muted caps={false} title="Style for every theme" open={false}>
		<p class="note">Applies under every theme, not just this one.</p>
		<div class="rows">
			{#each [...surfaces, ...details] as setting (setting.context.key)}
				<SettingRow {setting} />
			{/each}
		</div>
	</Section>
{:else}
	<div class="style">
		<Section card={false} muted title="Shape and background" collapsible={false}>
			<div class="rows">
				{#each surfaces as setting (setting.context.key)}
					<SettingRow {setting} />
				{/each}
			</div>
		</Section>
		{#if studioTheme}
			<Section card={false} muted title="Glow and grain" collapsible={false}>
				<p class="note">
					This theme's glow and grain are part of it.
					<button
						type="button"
						class="link"
						onclick={() => openThemeStudio(editorState.activeTheme)}>Edit in Theme Studio</button
					>
				</p>
			</Section>
		{:else if editing}
			<Section card={false} muted title="Glow" collapsible={false} privateTrailing={false}>
				{#snippet trailing()}
					<!-- A label, so a click anywhere on the switch reaches its checkbox. -->
					<label class="switch" aria-label="Glow">
						<Switch checked={editing!.target.glow.on} onCheckedChange={setGlow} />
					</label>
				{/snippet}
				<div class="rows">
					<GlowMap g={onScreen} target={editing.target} />
				</div>
			</Section>
			<Section card={false} muted title="Grain" collapsible={false}>
				<div class="rows">
					<GrainControl g={onScreen} target={editing.target} />
				</div>
			</Section>
		{/if}
		<Section card={false} muted title="Details" collapsible={false}>
			<div class="rows">
				{#each details as setting (setting.context.key)}
					<SettingRow {setting} />
				{/each}
			</div>
		</Section>
	</div>
{/if}

<style>
	.style {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-5);
		padding: var(--abt-space-4) 0 var(--abt-space-6);
		/* The panel body clips its content, so the panel scrolls itself. */
		overflow-y: auto;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		min-width: 0;
		padding: 0 12px; /* raw: matches panel Section's gutter */
	}
	.note {
		margin: 0;
		padding: 0 12px; /* raw: matches panel Section's gutter */
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-accent-text);
		font: inherit;
		cursor: pointer;
	}
	.link:hover {
		text-decoration: underline;
	}
</style>
