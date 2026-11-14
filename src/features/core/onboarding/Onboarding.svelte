<script lang="ts">
	import type { Setting } from "@features/types";
	import { applySettingChange, reapplySetting } from "@features/runtime";
	import { themeSelector } from "@features/theme/theme";
	import { NATIVE_THEME_KEY } from "@features/theme/theme-apply";
	import { DEFAULT_THEME } from "@features/theme/defaults";
	import { openThemeGallery } from "@features/theme/menu/gallery";
	import ThemeThumb from "@features/theme/picker/ThemeThumb.svelte";
	import { builtinThumb, placeholderThumb } from "@features/theme/picker/thumbs";
	import LayoutPicker from "@features/workflows/sidebar/LayoutPicker.svelte";
	import { LAYOUT_KEY } from "@features/workflows/sidebar/lib/layout";
	import { navigate } from "@lib/actual/actual-api";
	import { TWEAKS_PATH } from "@lib/actual/settings-page";
	import Icon from "@lib/components/Icon.svelte";
	import Switch from "@lib/components/Switch.svelte";
	import WritesMark from "@lib/components/WritesMark.svelte";
	import { themes } from "@lib/design";
	import type { IconName } from "@lib/icons";
	import { getValue, setValue, watchValue } from "@lib/store";
	import { ArrowRight, Check, X } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { fly } from "svelte/transition";

	const { onClose }: { onClose: () => void } = $props();

	const logoUrl = browser.runtime.getURL("/icon.svg");
	const LIVE_SIDEBAR = "experimental-sidebar";
	const INSET = "inset-panels";
	const FRAMES = [
		{ value: "off", label: "Flush", desc: "Edge to edge" },
		{ value: "cards", label: "Cards", desc: "Panels on a frame" },
		{ value: "floating", label: "Floating", desc: "Only the page lifts" },
	];

	/** A setting shown as a switch: `on` and `off` are the values its switch stands for. */
	type Toggle = { key: string; on: unknown; off: unknown; where?: string };

	const FEATURES: Toggle[] = [
		{
			key: "actual-template-apply-breakdown",
			on: true,
			off: false,
			where: "The Insights button on the budget page",
		},
		{ key: "spending-calendar-enabled", on: true, off: false, where: "Calendar, in the sidebar" },
		{ key: "graph-view", on: true, off: false, where: "Graph, in the sidebar" },
		{ key: "modern-reconcile", on: true, off: false, where: "Reconcile, in an account's toolbar" },
		{
			key: "transaction-inspector",
			on: true,
			off: false,
			where: "Inspect, in an account's toolbar",
		},
		{ key: "sync-recap", on: true, off: false, where: "After a bank sync or import" },
	];
	const TOUCHES: Toggle[] = [
		{ key: "budget-summary-row", on: "full", off: "light" },
		{ key: "color-amounts", on: "all", off: "off" },
		{ key: "category-color-dots", on: true, off: false },
	];
	const THEMES = [NATIVE_THEME_KEY, "midnight", "mocha", "latte", "daylight", "velvet"];

	const STEPS = [
		{ title: "Pick a look", text: "It applies straight away, and you can change it any time." },
		{ title: "Pick a layout", text: "How the sidebar and page sit in the window." },
		{
			title: "Choose your sidebar",
			text: "ABT's live sidebar adds balances, account groups, search and a command palette.",
		},
		{
			title: "Turn on the tools you want",
			text: "You can change any of these later in Tweaks settings.",
		},
		{ title: "A few finishing touches", text: "Small changes to the budget page." },
		{ title: "You're set", text: "" },
	];
	const LAST = STEPS.length - 1;

	let step = $state(0);
	// Which way the steps slide: forward from the right, back from the left.
	let direction = $state(1);
	const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const motion = (ms: number) => (reduced ? 0 : ms);

	let settings = $state<Map<string, Setting>>(new Map());
	let values = $state<Record<string, unknown>>({});
	let theme = $state<string | null>(null);

	const tracked = [...FEATURES, ...TOUCHES].map((t) => t.key).concat(LIVE_SIDEBAR, INSET);

	onMount(() => {
		const stops: (() => void)[] = [];
		void (async () => {
			// Lazily: the registry lists this card's own script, so a static import would be a cycle.
			const { scripts } = await import("@features/index");
			const all = new Map<string, Setting>();
			for (const s of scripts.flat()) {
				if (s.type !== "core") {
					all.set(s.context.key, s);
				}
			}
			settings = all;
			for (const key of tracked) {
				const setting = all.get(key);
				if (!setting || setting.type === "core") {
					continue;
				}
				values[key] = await getValue(key, setting.context.defaultValue);
				stops.push(watchValue(key, (v) => (values[key] = v ?? setting.context.defaultValue)));
			}
			theme = (await getValue("theme-auto-switch", false))
				? null
				: await getValue("catppuccin-palette", DEFAULT_THEME);
			// A theme picked in the full gallery shows here too.
			stops.push(watchValue<string>("catppuccin-palette", (v) => (theme = v ?? DEFAULT_THEME)));
		})();
		return () => stops.forEach((stop) => stop());
	});

	function go(to: number) {
		direction = to > step ? 1 : -1;
		step = to;
	}

	async function pickTheme(key: string) {
		theme = key;
		await setValue("theme-auto-switch", false);
		await setValue(themeSelector.context.key, key);
		// Its component types its context more narrowly than Setting does.
		await reapplySetting(themeSelector as unknown as Setting, key);
	}

	function isOn(t: Toggle): boolean {
		return values[t.key] === t.on;
	}

	async function toggle(t: Toggle, on: boolean) {
		const setting = settings.get(t.key);
		if (setting) {
			values[t.key] = on ? t.on : t.off;
			await applySettingChange(setting, on ? t.on : t.off);
		}
	}

	async function pickFrame(value: string) {
		const setting = settings.get(INSET);
		if (setting) {
			values[INSET] = value;
			await applySettingChange(setting, value);
		}
	}

	async function setLiveSidebar(on: boolean) {
		await toggle({ key: LIVE_SIDEBAR, on: true, off: false }, on);
	}

	const turnedOn = $derived(FEATURES.filter(isOn));

	function iconOf(key: string): IconName | undefined {
		const setting = settings.get(key);
		return setting && "icon" in setting ? (setting.icon as IconName | undefined) : undefined;
	}

	function labelOf(key: string): string {
		const setting = settings.get(key);
		return setting && setting.type !== "core" ? setting.label : "";
	}

	function openSettings() {
		onClose();
		navigate(TWEAKS_PATH);
	}

	// Below the titlebar, at the page's left edge next to the sidebar; it follows the sidebar's width.
	let pos = $state({ top: 72, left: 280 });
	onMount(() => {
		const place = () => {
			const card =
				document.querySelector("[data-abt-page-card]") ??
				document.querySelector("[data-abt-content-grid]");
			const header = document.querySelector("[data-abt-header]");
			if (!card) {
				return;
			}
			const rect = card.getBoundingClientRect();
			const below = header ? header.getBoundingClientRect().bottom : rect.top;
			pos = { top: Math.max(rect.top, below) + 16, left: rect.left + 16 };
		};
		place();
		const observer = new ResizeObserver(place);
		const card = document.querySelector("[data-abt-page-card]");
		if (card) {
			observer.observe(card);
		}
		addEventListener("resize", place);
		return () => {
			observer.disconnect();
			removeEventListener("resize", place);
		};
	});

	let bodyHeight = $state(0);
</script>

{#snippet toggleRow(t: Toggle)}
	{@const setting = settings.get(t.key)}
	{#if setting && setting.type !== "core"}
		<label class="row">
			<span class="row__icon">
				{#if "icon" in setting && setting.icon}
					<Icon name={setting.icon as IconName} size={16} strokeWidth={1.6} />
				{/if}
			</span>
			<span class="row__text">
				<span class="row__label">
					{setting.label}
					{#if "writes" in setting && setting.writes}<WritesMark writes={setting.writes} />{/if}
				</span>
				{#if "description" in setting && setting.description}
					<span class="row__desc">{setting.description}</span>
				{/if}
			</span>
			<Switch checked={isOn(t)} onCheckedChange={(on) => void toggle(t, on)} />
		</label>
	{/if}
{/snippet}

<div
	class="abt-popover onboarding"
	style:top="{pos.top}px"
	style:left="{pos.left}px"
	role="dialog"
	aria-label="Welcome to Actual Budget Tweaks"
>
	<div class="head">
		<img class="head__logo" src={logoUrl} alt="" />
		<div class="head__text">
			<span class="head__title">Welcome to ABT</span>
			<span class="head__step">
				{#if step < LAST}Step {step + 1} of {LAST}{:else}All done{/if}
			</span>
		</div>
		<div class="dots" aria-hidden="true">
			{#each { length: LAST } as _, i (i)}
				<span class="dot" class:dot--done={i < step} class:dot--now={i === step}></span>
			{/each}
		</div>
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			aria-label="Close"
			title="Close"
			onclick={onClose}
		>
			<X size={14} />
		</button>
	</div>

	<div class="body" style:height={bodyHeight ? `${bodyHeight}px` : undefined}>
		{#key step}
			<div
				class="step"
				bind:offsetHeight={bodyHeight}
				in:fly={{ x: 28 * direction, duration: motion(220), delay: motion(60), opacity: 0 }}
				out:fly={{ x: -28 * direction, duration: motion(140), opacity: 0 }}
			>
				<h3 class="step__title">{STEPS[step].title}</h3>
				{#if STEPS[step].text}<p class="step__text">{STEPS[step].text}</p>{/if}

				{#if step === 0}
					<div class="themes">
						{#each THEMES as key (key)}
							{@const native = key === NATIVE_THEME_KEY}
							<button
								type="button"
								class="theme"
								class:theme--on={theme === key}
								aria-pressed={theme === key}
								onclick={() => void pickTheme(key)}
							>
								<ThemeThumb
									thumb={(native ? null : builtinThumb(key)) ?? placeholderThumb("light")}
								/>
								<span class="theme__name">{native ? "Actual's" : themes[key]?.name}</span>
							</button>
						{/each}
					</div>
					<button type="button" class="more" onclick={openThemeGallery}>
						Browse all themes <ArrowRight size={13} />
					</button>
				{:else if step === 1}
					<div class="frames">
						{#each FRAMES as frame (frame.value)}
							<button
								type="button"
								class="frame-pick"
								class:frame-pick--on={values[INSET] === frame.value}
								aria-pressed={values[INSET] === frame.value}
								onclick={() => void pickFrame(frame.value)}
							>
								<span class="frame frame--{frame.value}" aria-hidden="true">
									<i class="frame__side"></i>
									<span class="frame__page"><i></i><i></i><i class="short"></i></span>
								</span>
								<span class="frame-pick__label">{frame.label}</span>
								<span class="frame-pick__desc">{frame.desc}</span>
							</button>
						{/each}
					</div>
				{:else if step === 2}
					<div class="choices">
						{#each [true, false] as live (live)}
							<button
								type="button"
								class="choice"
								class:choice--on={values[LIVE_SIDEBAR] === live}
								aria-pressed={values[LIVE_SIDEBAR] === live}
								onclick={() => void setLiveSidebar(live)}
							>
								<span class="choice__label">{live ? "Live sidebar" : "Actual's sidebar"}</span>
								<span class="choice__desc">
									{live ? "Balances, groups, search" : "The sidebar Actual comes with"}
								</span>
								{#if values[LIVE_SIDEBAR] === live}<span class="choice__check"
										><Check size={12} strokeWidth={2.5} /></span
									>{/if}
							</button>
						{/each}
					</div>
					{#if values[LIVE_SIDEBAR] === false && values[INSET] !== "off"}
						<p class="note">The layout you picked needs the live sidebar.</p>
					{/if}
					{#if values[LIVE_SIDEBAR] === true}
						<div class="layout">
							<span class="abt-label">Layout</span>
							<LayoutPicker ctx={{ key: LAYOUT_KEY, defaultValue: "split" }} />
						</div>
					{/if}
				{:else if step === 3}
					<div class="rows">
						{#each FEATURES as t (t.key)}{@render toggleRow(t)}{/each}
					</div>
				{:else if step === 4}
					<div class="rows">
						{#each TOUCHES as t (t.key)}{@render toggleRow(t)}{/each}
					</div>
				{:else}
					{#if turnedOn.length}
						<p class="step__text">Where to find what you turned on:</p>
						<ul class="where">
							{#each turnedOn as t (t.key)}
								{@const icon = iconOf(t.key)}
								<li>
									<span class="row__icon">
										{#if icon}<Icon name={icon} size={16} strokeWidth={1.6} />{/if}
									</span>
									<span class="where__text">
										<span class="where__name">{labelOf(t.key)}</span>
										<span class="where__place">{t.where}</span>
									</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="step__text">Actual works as before, with the look and sidebar you picked.</p>
					{/if}
					<button type="button" class="more" onclick={openSettings}>
						Everything else is in Tweaks settings <ArrowRight size={13} />
					</button>
				{/if}
			</div>
		{/key}
	</div>

	<div class="foot">
		{#if step < LAST}
			<button type="button" class="abt-btn abt-btn--ghost abt-btn--sm" onclick={onClose}
				>Skip</button
			>
		{/if}
		<span class="foot__space"></span>
		{#if step > 0}
			<button type="button" class="abt-btn abt-btn--sm" onclick={() => go(step - 1)}>Back</button>
		{/if}
		{#if step < LAST}
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-tone-accent"
				onclick={() => go(step + 1)}
			>
				Next
			</button>
		{:else}
			<button type="button" class="abt-btn abt-btn--sm abt-tone-accent" onclick={onClose}
				>Done</button
			>
		{/if}
	</div>
</div>

<style>
	.onboarding {
		position: fixed;
		/* Over the sidebar's wrapper (1001), which would cut off its shadow, and under Actual's
		   dialogs and toasts. */
		z-index: 1002;
		display: flex;
		flex-direction: column;
		width: 360px;
		max-height: calc(100vh - 2 * var(--abt-space-6));
		padding: var(--abt-space-5);
		border-radius: calc(var(--abt-radius) + 4px);
		box-shadow: var(--abt-shadow-lg);
		overflow: hidden;
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.head__logo {
		width: 28px;
		height: 28px;
		border-radius: var(--abt-radius);
	}
	.head__text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.head__title {
		font-weight: 600;
	}
	.head__step {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}
	.dots {
		display: flex;
		gap: var(--abt-space-1);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-3);
		transition:
			width 0.2s ease,
			background 0.2s ease;
	}
	.dot--done {
		background: var(--abt-accent-4);
	}
	.dot--now {
		width: 16px;
		background: var(--abt-accent);
	}

	/* Steps share one cell, so the outgoing one slides away over the incoming one. */
	.body {
		display: grid;
		margin: var(--abt-space-5) 0;
		overflow: hidden auto;
		transition: height 0.22s ease;
	}
	.step {
		grid-area: 1 / 1;
		align-self: start;
	}
	.step__title {
		margin: 0;
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}
	.step__text {
		margin: var(--abt-space-1) 0 0;
		color: var(--abt-muted);
		line-height: 1.45;
	}

	.themes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--abt-space-3);
		margin-top: var(--abt-space-4);
	}
	.theme {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		padding: var(--abt-space-2);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: var(--abt-ink-1);
		color: var(--abt-ink);
		font: inherit;
		cursor: pointer;
		transition:
			border-color 0.12s,
			background 0.12s;
	}
	.theme:hover {
		border-color: var(--abt-ink-4);
	}
	.theme--on,
	.theme--on:hover {
		border-color: var(--abt-accent);
		background: var(--abt-accent-1);
	}
	.theme :global(.thumb) {
		width: 100%;
		border-radius: var(--abt-radius-sm);
	}
	.theme__name {
		font-size: var(--abt-text-sm);
		font-weight: 500;
	}

	/* Sketches drawn in the current theme's own colours, so each shows the real result. */
	.frames {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--abt-space-3);
		margin-top: var(--abt-space-4);
	}
	.frame-pick {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px; /* raw: label hugs its subtitle */
		padding: var(--abt-space-2);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: var(--abt-ink-1);
		color: var(--abt-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.12s,
			background 0.12s;
	}
	.frame-pick:hover {
		border-color: var(--abt-ink-4);
	}
	.frame-pick--on,
	.frame-pick--on:hover {
		border-color: var(--abt-accent);
		background: var(--abt-accent-1);
	}
	.frame-pick__label {
		margin-top: var(--abt-space-2);
		font-size: var(--abt-text-sm);
		font-weight: 600;
	}
	.frame-pick__desc {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}
	.frame {
		display: flex;
		width: 100%;
		height: 58px;
		box-sizing: border-box;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		overflow: hidden;
	}
	.frame__side {
		width: 30%;
		background: var(--color-sidebarBackground);
	}
	.frame__page {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px; /* raw: sketch lines */
		padding: 6px; /* raw: sketch inset */
		background: var(--color-pageBackground);
	}
	.frame__page i {
		height: 3px; /* raw: sketch line */
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-3);
	}
	.frame__page i.short {
		width: 55%;
	}
	.frame--off .frame__side {
		border-right: 1px solid var(--abt-line);
	}
	.frame--cards,
	.frame--floating {
		gap: 3px; /* raw: sketch gap */
		padding: 3px; /* raw: sketch frame */
	}
	.frame--cards {
		background: var(--color-mobileViewTheme, var(--abt-ink-2));
	}
	.frame--cards .frame__side,
	.frame--cards .frame__page,
	.frame--floating .frame__page {
		border: 1px solid var(--abt-line);
		border-radius: 3px; /* raw: sketch corner */
	}
	.frame--floating {
		padding-left: 0;
		background: var(--color-sidebarBackground);
	}

	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--abt-space-3);
		margin-top: var(--abt-space-4);
	}
	.choice {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--abt-space-1);
		padding: var(--abt-space-3) var(--abt-space-4);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: var(--abt-ink-1);
		color: var(--abt-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.12s,
			background 0.12s;
	}
	.choice:hover {
		border-color: var(--abt-ink-4);
	}
	.choice--on,
	.choice--on:hover {
		border-color: var(--abt-accent);
		background: var(--abt-accent-1);
	}
	.choice__label {
		font-weight: 600;
	}
	.choice__desc {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.choice__check {
		position: absolute;
		top: var(--abt-space-2);
		right: var(--abt-space-2);
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent);
		color: var(--color-buttonPrimaryText, #fff); /* raw: text on the accent fill */
	}
	.note {
		margin: var(--abt-space-3) 0 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.layout {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		margin-top: var(--abt-space-4);
	}

	.rows {
		display: flex;
		flex-direction: column;
		margin-top: var(--abt-space-3);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) 0;
		border-top: 1px solid var(--abt-line);
		cursor: pointer;
	}
	.row:first-child {
		border-top: none;
	}
	.row__icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: var(--abt-radius);
		background: var(--abt-accent-1);
		color: var(--abt-accent);
	}
	.row__text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.row__label {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		font-weight: 500;
	}
	.row__desc {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
		line-height: 1.35;
	}

	.where {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		margin: var(--abt-space-3) 0 0;
		padding: 0;
		list-style: none;
	}
	.where li {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-2) var(--abt-space-3);
		border-radius: var(--abt-radius);
		background: var(--abt-ink-1);
	}
	.where__text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.where__name {
		font-weight: 500;
	}
	.where__place {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.more {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-1);
		margin-top: var(--abt-space-4);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-pageTextLink);
		font: inherit;
		cursor: pointer;
	}
	.more:hover {
		text-decoration: underline;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding-top: var(--abt-space-4);
		border-top: 1px solid var(--abt-line);
	}
	.foot__space {
		flex: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.body,
		.dot {
			transition: none;
		}
	}
</style>
