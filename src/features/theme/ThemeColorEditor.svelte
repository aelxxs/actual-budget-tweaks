<script lang="ts">
	import { getValue, setValue } from "@lib/utilities/store";
	import ColorRow from "./ColorRow.svelte";
	import { editorState, type ThemeOverrides } from "./editor-state.svelte";

	type ColorKeys = Record<string, string>;

	const STORAGE_KEY = "custom-theme";

	const COLOR_GROUPS: { label: string; keys: string[] }[] = [
		{
			label: "Budget",
			keys: [
				"--color-budgetCurrentMonth",
				"--color-budgetHeaderCurrentMonth",
				"--color-budgetHeaderOtherMonth",
				"--color-budgetOtherMonth",
				"--color-budgetNumberNegative",
				"--color-budgetNumberNeutral",
				"--color-budgetNumberPositive",
				"--color-budgetNumberZero",
			],
		},
		{
			label: "Buttons",
			keys: [
				"--color-buttonBareBackground",
				"--color-buttonBareBackgroundActive",
				"--color-buttonBareBackgroundHover",
				"--color-buttonBareDisabledBackground",
				"--color-buttonBareDisabledText",
				"--color-buttonBareText",
				"--color-buttonBareTextHover",
				"--color-buttonMenuBackground",
				"--color-buttonMenuBackgroundHover",
				"--color-buttonMenuBorder",
				"--color-buttonMenuSelectedBackground",
				"--color-buttonMenuSelectedBackgroundHover",
				"--color-buttonMenuSelectedBorder",
				"--color-buttonMenuSelectedText",
				"--color-buttonMenuSelectedTextHover",
				"--color-buttonMenuText",
				"--color-buttonMenuTextHover",
				"--color-buttonNormalBackground",
				"--color-buttonNormalBackgroundHover",
				"--color-buttonNormalBorder",
				"--color-buttonNormalDisabledBackground",
				"--color-buttonNormalDisabledBorder",
				"--color-buttonNormalDisabledText",
				"--color-buttonNormalSelectedBackground",
				"--color-buttonNormalSelectedText",
				"--color-buttonNormalText",
				"--color-buttonNormalTextHover",
				"--color-buttonPrimaryBackground",
				"--color-buttonPrimaryBackgroundHover",
				"--color-buttonPrimaryBorder",
				"--color-buttonPrimaryDisabledBackground",
				"--color-buttonPrimaryDisabledBorder",
				"--color-buttonPrimaryDisabledText",
				"--color-buttonPrimaryText",
				"--color-buttonPrimaryTextHover",
			],
		},
		{
			label: "Forms",
			keys: [
				"--color-formInputBackground",
				"--color-formInputBackgroundSelected",
				"--color-formInputBackgroundSelection",
				"--color-formInputBorder",
				"--color-formInputBorderSelected",
				"--color-formInputText",
				"--color-formInputTextHighlight",
				"--color-formInputTextPlaceholder",
				"--color-formInputTextPlaceholderSelected",
				"--color-formInputTextSelected",
				"--color-formInputTextSelection",
				"--color-formLabelBackground",
				"--color-formLabelText",
			],
		},
		{
			label: "Page",
			keys: [
				"--color-pageBackground",
				"--color-pageBackgroundBottomRight",
				"--color-pageBackgroundLineBottom",
				"--color-pageBackgroundLineMid",
				"--color-pageBackgroundLineTop",
				"--color-pageBackgroundModalActive",
				"--color-pageBackgroundTopLeft",
				"--color-pageText",
				"--color-pageTextDark",
				"--color-pageTextLight",
				"--color-pageTextLink",
				"--color-pageTextLinkLight",
				"--color-pageTextPositive",
				"--color-pageTextSubdued",
				"--color-modalBackground",
				"--color-modalBorder",
				"--color-overlayBackground",
			],
		},
		{
			label: "Sidebar",
			keys: [
				"--color-sidebarBackground",
				"--color-sidebarBudgetName",
				"--color-sidebarItemAccentSelected",
				"--color-sidebarItemBackgroundFailed",
				"--color-sidebarItemBackgroundHover",
				"--color-sidebarItemBackgroundPending",
				"--color-sidebarItemBackgroundPositive",
				"--color-sidebarItemText",
				"--color-sidebarItemTextSelected",
			],
		},
		{
			label: "Table",
			keys: [
				"--color-tableBackground",
				"--color-tableBorder",
				"--color-tableBorderHover",
				"--color-tableBorderSelected",
				"--color-tableBorderSeparator",
				"--color-tableHeaderBackground",
				"--color-tableHeaderText",
				"--color-tableHeaderSubText",
				"--color-tableRowBackgroundHighlight",
				"--color-tableRowBackgroundHighlightText",
				"--color-tableRowBackgroundHover",
				"--color-tableRowHeaderBackground",
				"--color-tableRowHeaderText",
				"--color-tableText",
				"--color-tableTextHover",
				"--color-tableTextInactive",
				"--color-tableTextLight",
				"--color-tableTextSelected",
				"--color-tableTextSubdued",
			],
		},
		{
			label: "Menus",
			keys: [
				"--color-menuAutoCompleteBackground",
				"--color-menuAutoCompleteBackgroundHover",
				"--color-menuAutoCompleteItemText",
				"--color-menuAutoCompleteItemTextHover",
				"--color-menuAutoCompleteText",
				"--color-menuAutoCompleteTextHeader",
				"--color-menuAutoCompleteTextHover",
				"--color-menuBackground",
				"--color-menuBorder",
				"--color-menuBorderHover",
				"--color-menuItemBackground",
				"--color-menuItemBackgroundHover",
				"--color-menuItemText",
				"--color-menuItemTextHeader",
				"--color-menuItemTextHover",
				"--color-menuItemTextSelected",
				"--color-menuKeybindingText",
			],
		},
		{
			label: "States",
			keys: [
				"--color-errorBackground",
				"--color-errorBorder",
				"--color-errorText",
				"--color-errorTextDark",
				"--color-errorTextDarker",
				"--color-errorTextMenu",
				"--color-noticeBackground",
				"--color-noticeBackgroundDark",
				"--color-noticeBackgroundLight",
				"--color-noticeBorder",
				"--color-noticeText",
				"--color-noticeTextDark",
				"--color-noticeTextLight",
				"--color-noticeTextMenu",
				"--color-noticeTextMenuHover",
				"--color-warningBackground",
				"--color-warningBorder",
				"--color-warningText",
				"--color-warningTextDark",
				"--color-warningTextLight",
				"--color-upcomingBackground",
				"--color-upcomingBorder",
				"--color-upcomingText",
			],
		},
		{
			label: "Charts",
			keys: [
				"--color-chartQual1",
				"--color-chartQual2",
				"--color-chartQual3",
				"--color-chartQual4",
				"--color-chartQual5",
				"--color-chartQual6",
				"--color-chartQual7",
				"--color-chartQual8",
				"--color-chartQual9",
				"--color-reportsBlue",
				"--color-reportsChartFill",
				"--color-reportsGray",
				"--color-reportsGreen",
				"--color-reportsRed",
				"--color-reportsInnerLabel",
				"--color-reportsLabel",
				"--color-reportsNumberNegative",
				"--color-reportsNumberNeutral",
				"--color-reportsNumberPositive",
			],
		},
		{
			label: "Misc",
			keys: [
				"--color-calendarBackground",
				"--color-calendarCellBackground",
				"--color-calendarItemBackground",
				"--color-calendarItemText",
				"--color-calendarSelectedBackground",
				"--color-calendarText",
				"--color-cardBackground",
				"--color-cardBorder",
				"--color-cardShadow",
				"--color-checkboxBackgroundSelected",
				"--color-checkboxBorderSelected",
				"--color-checkboxText",
				"--color-checkboxToggleBackground",
				"--color-checkboxToggleBackgroundSelected",
				"--color-checkboxToggleDisabled",
				"--color-floatingActionBarBackground",
				"--color-floatingActionBarBorder",
				"--color-floatingActionBarText",
				"--color-noteTagBackground",
				"--color-noteTagBackgroundHover",
				"--color-noteTagText",
				"--color-pillBackground",
				"--color-pillBackgroundLight",
				"--color-pillBackgroundSelected",
				"--color-pillBorder",
				"--color-pillBorderDark",
				"--color-pillBorderSelected",
				"--color-pillText",
				"--color-pillTextHighlighted",
				"--color-pillTextSelected",
				"--color-pillTextSubdued",
				"--color-tooltipBackground",
				"--color-tooltipBorder",
				"--color-tooltipText",
				"--color-numberNegative",
				"--color-numberNeutral",
				"--color-numberPositive",
				"--color-templateNumberFunded",
				"--color-templateNumberUnderFunded",
				"--color-toBudgetNegative",
				"--color-toBudgetPositive",
				"--color-toBudgetZero",
			],
		},
	];

	// "--color-tableRowBackgroundHover" → "Row Background Hover"
	function toLabel(key: string): string {
		const withoutPrefix = key.replace(/^--color-[a-z]+/i, "");
		return withoutPrefix.replace(/([A-Z])/g, " $1").trim() || key.replace(/^--color-/, "");
	}

	function rgbToHex(rgb: string): string | null {
		const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (!m) return null;
		return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
	}

	function resolveViaCanvas(value: string): string | null {
		try {
			const canvas = document.createElement("canvas");
			canvas.width = canvas.height = 1;
			const ctx = canvas.getContext("2d");
			if (!ctx) return null;
			ctx.fillStyle = value;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
		} catch {
			return null;
		}
	}

	function resolveToHex(raw: string): string | null {
		if (!raw) return null;
		raw = raw.trim();
		if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
		if (/^rgb/.test(raw)) return rgbToHex(raw);
		return resolveViaCanvas(raw);
	}

	function getComputedTokens(): ColorKeys {
		const root = document.querySelector<HTMLElement>(":root");
		if (!root) return {};
		const computed = getComputedStyle(root);
		const result: ColorKeys = {};
		for (const group of COLOR_GROUPS) {
			for (const key of group.keys) {
				result[key] = computed.getPropertyValue(key).trim();
			}
		}
		return result;
	}

	let colors = $state<ColorKeys>({});
	let baseColors = $state<ColorKeys>({});
	let pickerValues = $state<ColorKeys>({});
	let savedColors = $state<ColorKeys>({});
	let currentTheme = "";
	let activeGroup = $state(0);
	let isSaving = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let search = $state("");

	const allKeys = COLOR_GROUPS.flatMap((g) => g.keys);
	const isDirty = $derived(allKeys.some((k) => colors[k] !== savedColors[k]));
	const filteredKeys = $derived(
		search.trim()
			? COLOR_GROUPS[activeGroup].keys.filter((k) => k.toLowerCase().includes(search.toLowerCase()))
			: COLOR_GROUPS[activeGroup].keys,
	);

	let {
		onReady,
	}: {
		onReady?: (api: { reset: () => void; getExportCSS: () => string }) => void;
	} = $props();

	function getExportCSS(): string {
		const lines = allKeys.map((key) => `  ${key}: ${colors[key] ?? ""};`).filter((line) => !line.endsWith(": ;"));
		return `:root {\n${lines.join("\n")}\n}`;
	}

	$effect(() => {
		editorState.isSaving = isSaving;
		editorState.isDirty = isDirty;
	});

	$effect(() => {
		const theme = editorState.activeTheme;
		void initForTheme(theme);
	});

	async function initForTheme(theme: string) {
		if (theme === currentTheme) return;

		// Flush pending save for the outgoing theme before switching
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
			await doSave(currentTheme);
		}
		currentTheme = theme;

		const computed = getComputedTokens();
		const resolved: ColorKeys = {};
		for (const [key, val] of Object.entries(computed)) {
			resolved[key] = resolveToHex(val) ?? val;
		}

		const allSaved = await getValue<ThemeOverrides | ColorKeys | null>(STORAGE_KEY, null);
		const themeOverrides = extractThemeOverrides(allSaved, theme);

		baseColors = { ...resolved };
		const merged = { ...resolved, ...themeOverrides };
		colors = { ...merged };
		savedColors = { ...merged };
		pickerValues = { ...merged };

		onReady?.({ reset: resetAll, getExportCSS });
	}

	function extractThemeOverrides(stored: ThemeOverrides | ColorKeys | null, theme: string): ColorKeys {
		if (!stored) return {};
		const firstKey = Object.keys(stored)[0];
		// Migrate old flat format (keys start with "--")
		if (firstKey?.startsWith("--")) return stored as ColorKeys;
		return (stored as ThemeOverrides)[theme] ?? {};
	}

	function applyColors(keys: ColorKeys) {
		const root = document.querySelector<HTMLElement>(":root");
		if (!root) return;
		for (const [key, val] of Object.entries(keys)) {
			root.style.setProperty(key, val);
		}
	}

	function handlePickerChange(key: string, value: string) {
		colors[key] = value;
		pickerValues[key] = value;
		applyColors({ [key]: value });
		scheduleSave();
	}

	function handleHexInput(key: string, value: string) {
		colors[key] = value;
		if (/^#[0-9a-f]{6}$/i.test(value) || /^#[0-9a-f]{3}$/i.test(value)) {
			pickerValues[key] = value;
			applyColors({ [key]: value });
			scheduleSave();
		}
	}

	async function doSave(theme: string) {
		if (!theme) return;
		const stored = (await getValue<ThemeOverrides | ColorKeys | null>(STORAGE_KEY, null)) ?? {};
		const firstKey = Object.keys(stored)[0];
		const base: ThemeOverrides = firstKey?.startsWith("--") ? {} : (stored as ThemeOverrides);

		// Only save the diff from the base theme values
		const diff: ColorKeys = {};
		for (const key of allKeys) {
			if (colors[key] !== undefined && colors[key] !== baseColors[key]) {
				diff[key] = colors[key];
			}
		}

		const updated: ThemeOverrides =
			Object.keys(diff).length > 0
				? { ...base, [theme]: diff }
				: (({ [theme]: _, ...rest }) => rest)(base as Record<string, ColorKeys>);

		await setValue(STORAGE_KEY, Object.keys(updated).length > 0 ? updated : null);
		editorState.overrides = { ...updated };
		savedColors = { ...colors };
	}

	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		isSaving = true;
		saveTimer = setTimeout(async () => {
			await doSave(currentTheme);
			isSaving = false;
		}, 600);
	}

	async function resetAll() {
		// Remove only this theme's overrides from storage
		const stored = (await getValue<ThemeOverrides | ColorKeys | null>(STORAGE_KEY, null)) ?? {};
		const firstKey = Object.keys(stored)[0];
		const base: ThemeOverrides = firstKey?.startsWith("--") ? {} : { ...(stored as ThemeOverrides) };
		delete base[currentTheme];
		const next = Object.keys(base).length > 0 ? base : null;
		await setValue(STORAGE_KEY, next);
		editorState.overrides = { ...(next ?? {}) };

		const root = document.querySelector<HTMLElement>(":root");
		if (root) {
			for (const key of allKeys) root.style.removeProperty(key);
		}
		const computed = getComputedTokens();
		const resolved: ColorKeys = {};
		for (const [key, val] of Object.entries(computed)) {
			resolved[key] = resolveToHex(val) ?? val;
		}
		baseColors = { ...resolved };
		colors = { ...resolved };
		savedColors = { ...resolved };
		pickerValues = { ...resolved };
	}
</script>

<div class="editor">
	<div class="editor__tabs">
		{#each COLOR_GROUPS as group, i}
			<button
				class="editor__tab"
				class:editor__tab--active={activeGroup === i}
				onclick={() => {
					activeGroup = i;
					search = "";
				}}
			>
				{group.label}
			</button>
		{/each}
	</div>

	<div class="editor__search">
		<input class="editor__search-input" type="text" placeholder="Filter tokens…" bind:value={search} />
	</div>

	<div class="editor__rows">
		{#each filteredKeys as key}
			<ColorRow
				label={toLabel(key)}
				value={colors[key] ?? ""}
				onHexInput={(v) => handleHexInput(key, v)}
				onPickerChange={(v) => handlePickerChange(key, v)}
			/>
		{/each}

		{#if filteredKeys.length === 0}
			<p class="editor__empty">No tokens match "{search}"</p>
		{/if}
	</div>
</div>

<style>
	.editor {
		font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
		display: flex;
		flex-direction: column;
		height: 100%;
		color: var(--color-pageText);
	}

	.editor__tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 10px 12px 0;
		flex-shrink: 0;
	}

	.editor__tab {
		font-family: inherit;
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 4px 10px 5px;
		border-radius: 6px 6px 0 0;
		border: var(--border);
		border-bottom: none;
		background: transparent;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.editor__tab:hover {
		color: var(--color-pageText);
	}

	.editor__tab--active {
		background: var(--color-tableBackground);
		color: var(--color-sidebarItemAccentSelected);
	}

	.editor__search {
		padding: 8px 12px;
		border-bottom: var(--border);
		flex-shrink: 0;
	}

	.editor__search-input {
		font-family: inherit;
		font-size: 11px;
		width: 100%;
		padding: 5px 8px;
		border-radius: 6px;
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		outline: none;
		box-sizing: border-box;
	}

	.editor__search-input::placeholder {
		color: var(--color-formInputTextPlaceholder);
	}
	.editor__search-input:focus {
		border-color: var(--color-formInputBorderSelected);
	}

	.editor__rows {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0 16px;
	}

	.editor__empty {
		padding: 20px 16px;
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		margin: 0;
	}
</style>
