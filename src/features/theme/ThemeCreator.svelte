<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import Tabs from "@lib/components/Tabs.svelte";
	import { applyGlobalCSS } from "@lib/utilities/dom";
	import { onMount } from "svelte";
	import ColorRow from "./ColorRow.svelte";
	import { BUILTIN_CSS, TOKENS_STYLE_ID } from "./theme-apply";

	type Tab = "palette" | "css";

	const ACCENT_VARS = [
		{ key: "--ctp-rosewater", label: "Accent 1" },
		{ key: "--ctp-flamingo", label: "Accent 2" },
		{ key: "--ctp-pink", label: "Accent 3" },
		{ key: "--ctp-mauve", label: "Accent 4" },
		{ key: "--ctp-red", label: "Accent 5" },
		{ key: "--ctp-maroon", label: "Accent 6" },
		{ key: "--ctp-peach", label: "Accent 7" },
		{ key: "--ctp-yellow", label: "Accent 8" },
		{ key: "--ctp-green", label: "Accent 9" },
		{ key: "--ctp-teal", label: "Accent 10" },
		{ key: "--ctp-sky", label: "Accent 11" },
		{ key: "--ctp-sapphire", label: "Accent 12" },
		{ key: "--ctp-blue", label: "Accent 13" },
		{ key: "--ctp-lavender", label: "Accent 14" },
	];

	const SURFACE_VARS = [
		{ key: "--ctp-text", label: "Body Text" },
		{ key: "--ctp-subtext1", label: "Secondary Text" },
		{ key: "--ctp-subtext0", label: "Subtle Text" },
		{ key: "--ctp-overlay2", label: "Overlay Light" },
		{ key: "--ctp-overlay1", label: "Overlay" },
		{ key: "--ctp-overlay0", label: "Overlay Dark" },
		{ key: "--ctp-surface2", label: "Surface Light" },
		{ key: "--ctp-surface1", label: "Surface" },
		{ key: "--ctp-surface0", label: "Surface Dark" },
		{ key: "--ctp-base", label: "Base" },
		{ key: "--ctp-mantle", label: "Mantle" },
		{ key: "--ctp-crust", label: "Background" },
	];

	const ALL_VARS = [...ACCENT_VARS, ...SURFACE_VARS];

	let {
		initialKeys,
		initialCss,
		initialTab,
		onPaletteChange,
		onCssApply,
	}: {
		initialKeys?: Record<string, string>;
		initialCss?: string;
		initialTab?: Tab;
		onPaletteChange: (keys: Record<string, string>) => void;
		onCssApply: (css: string) => void;
	} = $props();

	let activeTab = $state<Tab>(initialTab ?? "palette");
	let colors = $state<Record<string, string>>({});
	let cssInput = $state(initialCss ?? "");

	onMount(() => {
		if (initialKeys && Object.keys(initialKeys).length > 0) {
			colors = { ...initialKeys };
		} else {
			const root = document.querySelector<HTMLElement>(":root");
			if (!root) return;
			const computed = getComputedStyle(root);
			for (const v of ALL_VARS) {
				const raw = computed.getPropertyValue(v.key).trim();
				colors[v.key] = raw.startsWith("#") ? raw : (rgbToHex(raw) ?? raw);
			}
		}
	});

	function rgbToHex(rgb: string): string | null {
		const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (!m) return null;
		return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
	}

	function handleColorChange(key: string, value: string) {
		colors[key] = value;
		const root = document.querySelector<HTMLElement>(":root");
		if (root) {
			root.style.setProperty(key, value);
		}
		applyGlobalCSS(BUILTIN_CSS, TOKENS_STYLE_ID);
		onPaletteChange({ ...colors });
	}

	function handleHexInput(key: string, value: string) {
		colors[key] = value;
		if (/^#[0-9a-f]{6}$/i.test(value) || /^#[0-9a-f]{3}$/i.test(value)) {
			handleColorChange(key, value);
		}
	}

	function hslToHex(h: number, s: number, l: number): string {
		h = ((h % 360) + 360) % 360;
		s = Math.max(0, Math.min(100, s)) / 100;
		l = Math.max(0, Math.min(100, l)) / 100;
		const a = s * Math.min(l, 1 - l);
		const f = (n: number) => {
			const k = (n + h / 30) % 12;
			const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
			return Math.round(255 * color)
				.toString(16)
				.padStart(2, "0");
		};
		return `#${f(0)}${f(8)}${f(4)}`;
	}

	function randomize() {
		const baseHue = Math.floor(Math.random() * 360);
		const isDark = Math.random() > 0.3;
		const baseSat = 15 + Math.random() * 20;

		const surfaceL = isDark
			? [92, 78, 68, 58, 48, 40, 32, 26, 22, 16, 12, 8]
			: [10, 20, 30, 40, 48, 55, 72, 78, 84, 92, 95, 97];

		const surfaceKeys = SURFACE_VARS.map((v) => v.key);
		const surfaceColors: Record<string, string> = {};
		surfaceKeys.forEach((key, i) => {
			surfaceColors[key] = hslToHex(baseHue, baseSat * (isDark ? 0.3 + i * 0.05 : 0.6 - i * 0.03), surfaceL[i]);
		});

		const accentSat = 55 + Math.random() * 25;
		const accentL = isDark ? 70 + Math.random() * 10 : 40 + Math.random() * 15;
		const accentColors: Record<string, string> = {};
		ACCENT_VARS.forEach((v, i) => {
			const hue = (baseHue + (i * 360) / ACCENT_VARS.length + Math.random() * 10) % 360;
			accentColors[v.key] = hslToHex(hue, accentSat + Math.random() * 10 - 5, accentL + Math.random() * 8 - 4);
		});

		const newColors = { ...surfaceColors, ...accentColors };
		colors = { ...newColors };

		const root = document.querySelector<HTMLElement>(":root");
		if (root) {
			for (const [key, val] of Object.entries(newColors)) {
				root.style.setProperty(key, val);
			}
		}
		applyGlobalCSS(BUILTIN_CSS, TOKENS_STYLE_ID);
		onPaletteChange({ ...newColors });
	}

	function applyCss() {
		const trimmed = cssInput.trim();
		if (!trimmed) return;
		onCssApply(trimmed);
	}
</script>

<div class="creator">
	<Tabs
		tabs={[
			{ value: "palette", label: "Palette" },
			{ value: "css", label: "Import CSS" },
		]}
		bind:value={activeTab}
	/>

	{#if activeTab === "palette"}
		<div class="creator__toolbar">
			<button class="creator__randomize" onclick={randomize}>
				<Icon name="shuffle" size={14} />
				Randomize
			</button>
		</div>
		<div class="creator__rows">
			<div class="creator__group-label">Accents</div>
			{#each ACCENT_VARS as v (v.key)}
				<ColorRow
					label={v.label}
					value={colors[v.key] ?? "#000000"}
					onHexInput={(val) => handleHexInput(v.key, val)}
					onPickerChange={(val) => handleColorChange(v.key, val)}
				/>
			{/each}

			<div class="creator__group-label">Surfaces & Text</div>
			{#each SURFACE_VARS as v (v.key)}
				<ColorRow
					label={v.label}
					value={colors[v.key] ?? "#000000"}
					onHexInput={(val) => handleHexInput(v.key, val)}
					onPickerChange={(val) => handleColorChange(v.key, val)}
				/>
			{/each}
		</div>
	{:else}
		<div class="creator__css">
			<textarea
				class="creator__css-input"
				placeholder={`:root {\n  --color-pageBackground: #1e1e2e;\n  --color-pageText: #cdd6f4;\n  /* ... all color tokens */\n}`}
				bind:value={cssInput}
				rows="16"
			></textarea>
			<button class="creator__css-apply" onclick={applyCss}>Apply CSS</button>
		</div>
	{/if}
</div>

<style>
	.creator {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		color: var(--color-pageText);
	}

	.creator__toolbar {
		display: flex;
		padding: 8px 12px;
		flex-shrink: 0;
	}

	.creator__randomize {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		font-family: inherit;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px dashed color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 5%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.creator__randomize:hover {
		border-color: var(--color-sidebarItemAccentSelected);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, transparent);
	}

	.creator__rows {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0 16px;
	}

	.creator__group-label {
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
		font-weight: 600;
		padding: 12px 12px 4px;
	}

	.creator__css {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
	}

	.creator__css-input {
		flex: 1;
		font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
		font-size: 11px;
		padding: 10px;
		border-radius: 6px;
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		resize: none;
		outline: none;
	}

	.creator__css-input:focus {
		border-color: var(--color-formInputBorderSelected);
	}

	.creator__css-input::placeholder {
		color: var(--color-formInputTextPlaceholder);
	}

	.creator__css-apply {
		font-family: inherit;
		font-size: 11px;
		padding: 7px 12px;
		border-radius: 6px;
		border: none;
		background: var(--color-buttonPrimaryBackground);
		color: var(--color-buttonPrimaryText);
		cursor: pointer;
		align-self: flex-end;
	}

	.creator__css-apply:hover {
		filter: brightness(1.1);
	}
</style>
