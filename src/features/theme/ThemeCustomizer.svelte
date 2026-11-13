<script lang="ts" module>
	export const GALLERY_APP_KEY = "theme-gallery-app";
</script>

<script lang="ts">
	import { FEATURED_THEMES, themes } from "@lib/design";
	import { getValue, setValue, watchValue } from "@lib/utilities/store";
	import { type Mounted, mountToNodeWithReturn, mountToPanelBody } from "@lib/utilities/svelte";
	import { type Component, onDestroy, onMount, untrack } from "svelte";
	import { sidepanel } from "../core/side-panel";
	import { DEFAULT_THEME } from "./defaults";
	import { editorState, resetFn, setResetFn } from "./editor-state.svelte";
	import {
		applyThemeByKey,
		applyUserCSSTheme,
		applyUserPaletteTheme,
		fetchCommunityThemeCatalog,
		getNativePreviewColors,
		isCommunityTheme,
		NATIVE_THEME_KEY,
		type RemoteTheme,
	} from "./theme-apply";
	import ThemeColorEditor from "./editor/ThemeColorEditor.svelte";
	import ThemeCreator from "./editor/ThemeCreator.svelte";
	import ThemeCreatorHeader from "./editor/ThemeCreatorHeader.svelte";
	import ThemeEditorHeader from "./editor/ThemeEditorHeader.svelte";
	import {
		deleteUserTheme,
		generateThemeId,
		isUserTheme,
		loadUserThemes,
		saveUserTheme,
		userThemeState,
		type UserTheme,
	} from "./user-themes.svelte";
	import { createLogger } from "@lib/utilities/logger";
	import { openPaletteInStudio, openThemeStudio } from "./studio/open";
	import ThemeCard, { type CardAction } from "./picker/ThemeCard.svelte";
	import ThemeThumb from "./picker/ThemeThumb.svelte";
	import {
		builtinThumb,
		communityThumb,
		nativeThumb,
		placeholderThumb,
		type Thumb,
		userThumb,
	} from "./picker/thumbs";
	import { ChevronRight, LayoutGrid, Paintbrush, Plus, Shapes } from "@lucide/svelte";
	import { openStylePanel } from "./style/open";

	const log = createLogger("themes");

	let {
		ctx,
		galleryOnly = false,
	}: {
		ctx: { key: string; defaultValue: string };
		/** Only the gallery, opened at once as a panel that follows you (the Modern Titlebar's theme menu). */
		galleryOnly?: boolean;
	} = $props();

	let activeThemeKey = $derived(ctx.defaultValue);
	let applyingTheme = $state<string | null>(null);
	let remoteThemes = $state<RemoteTheme[]>([]);
	let loadingRemote = $state(false);
	let remoteError = $state(false);
	let searchQuery = $state("");
	let themeFilter = $state("all");

	let autoSwitch = $state(false);
	let autoDarkKey = $state(DEFAULT_THEME);
	let autoLightKey = $state("latte");
	let systemIsDark = $state(window.matchMedia("(prefers-color-scheme: dark)").matches);

	const mql = window.matchMedia("(prefers-color-scheme: dark)");
	function onSchemeChange(e: MediaQueryListEvent) {
		systemIsDark = e.matches;
		if (autoSwitch) {
			const key = systemIsDark ? autoDarkKey : autoLightKey;
			activeThemeKey = key;
			applyThemeByKey(key, ctx.defaultValue);
		}
	}
	mql.addEventListener("change", onSchemeChange);
	onDestroy(() => mql.removeEventListener("change", onSchemeChange));
	onDestroy(() => {
		for (const mounted of [editor, editorHeader, creator, creatorHeader]) {
			mounted?.destroy();
		}
	});

	// A panel header row, laid out like the side panel's own.
	function mountHeader<T extends Record<string, unknown>>(
		component: Component<T>,
		props: T,
	): Mounted {
		const header = mountToNodeWithReturn(component, props);
		header.node.style.cssText = "display: flex; flex: 1;";
		return header;
	}

	function getThemeName(key: string): string {
		if (key === NATIVE_THEME_KEY) {
			return "Actual default";
		}
		if (themes[key]) {
			return themes[key].name;
		}
		if (isUserTheme(key)) {
			return userThemeState.themes[key]?.name ?? key;
		}
		if (isCommunityTheme(key)) {
			const remote = remoteThemes.find((t) => t.repo === key);
			return remote?.name ?? key.split("/").pop() ?? key;
		}
		return key;
	}

	let nativeColors = $state<string[]>([]);

	/** In Match system, the slot that clicking a theme fills. */
	let slot = $state<"light" | "dark">("dark");
	const slotKey = $derived(slot === "dark" ? autoDarkKey : autoLightKey);
	/** The theme cards mark as chosen: the slot's theme in Match system, else the applied one. */
	const selectedKey = $derived(autoSwitch ? slotKey : activeThemeKey);

	async function setMatchSystem(on: boolean) {
		if (on === autoSwitch) {
			return;
		}
		autoSwitch = on;
		await setValue("theme-auto-switch", on);
		if (on) {
			slot = systemIsDark ? "dark" : "light";
			const key = systemIsDark ? autoDarkKey : autoLightKey;
			activeThemeKey = key;
			await applyThemeByKey(key, ctx.defaultValue);
		} else {
			// Keeps what's on screen as the one theme.
			await setValue(ctx.key, activeThemeKey);
		}
	}

	function pickSlot(mode: "light" | "dark") {
		slot = mode;
		themeFilter = mode;
		sidepanel.setTitle(galleryTitle());
	}

	// ── Gallery: opened on demand in the side panel ──
	const PREVIEW = 4;
	let galleryOpen = $state(false);
	let galleryNode: HTMLElement | null = null;
	let expanded = $state<Record<string, boolean>>({});

	function galleryTitle() {
		if (!autoSwitch) {
			return "Themes";
		}
		return slot === "dark" ? "Dark theme" : "Light theme";
	}
	function showGallery(node: HTMLElement) {
		sidepanel.open({
			title: galleryTitle(),
			bodyNode: node,
			key: galleryOnly ? GALLERY_APP_KEY : "theme-gallery",
			scope: galleryOnly ? "app" : "page",
		});
	}
	function inPanel(node: HTMLElement) {
		galleryNode = node;
		// After this effect: opening the panel updates its state, which mustn't run inside it.
		queueMicrotask(() => untrack(() => showGallery(node)));
		return () => {
			// The card unmounted (a settings search can do it), so its gallery can't stay open empty.
			if (node.isConnected) {
				sidepanel.close(galleryOnly ? GALLERY_APP_KEY : "theme-gallery");
			}
			galleryNode = null;
		};
	}
	/** Opens on the mode in use, or the slot being changed; the others stay a click away. */
	function openGallery(mode: "light" | "dark" | null) {
		if (mode) {
			slot = mode;
		}
		themeFilter = autoSwitch ? slot : modeOf(activeThemeKey);
		searchQuery = "";
		expanded = {};
		if (galleryNode) {
			showGallery(galleryNode);
		} else {
			galleryOpen = true;
		}
	}
	/** Moves the mode switch into the settings section's header; it stays where it is anywhere else. */
	function inHeader(node: HTMLElement) {
		const slot = node.closest(".settings-section")?.querySelector("[data-section-slot]");
		slot?.append(node);
	}

	/** The first few, keeping the chosen one in view. */
	function visible<T>(id: string, list: T[], keyOf: (t: T) => string, limit = PREVIEW): T[] {
		if (q || expanded[id] || list.length <= limit) {
			return list;
		}
		const head = list.slice(0, limit);
		const chosen = list.find((t) => keyOf(t) === selectedKey);
		return chosen && !head.includes(chosen) ? [...head.slice(0, limit - 1), chosen] : head;
	}

	async function setAutoTheme(mode: "dark" | "light", key: string) {
		if (mode === "dark") {
			autoDarkKey = key;
			await setValue("theme-auto-dark", key);
		} else {
			autoLightKey = key;
			await setValue("theme-auto-light", key);
		}
		if ((mode === "dark" && systemIsDark) || (mode === "light" && !systemIsDark)) {
			activeThemeKey = key;
			await applyThemeByKey(key, ctx.defaultValue);
		}
	}

	let editor: Mounted | null = null;
	let editorHeader: Mounted | null = null;

	let exportFn: (() => string) | null = null;

	const openColorEditor = () => {
		if (!editor) {
			editor = mountToPanelBody(ThemeColorEditor, {
				onReady: ({ reset, getExportCSS }: { reset: () => void; getExportCSS: () => string }) => {
					setResetFn(reset);
					exportFn = getExportCSS;
				},
			});
			editorHeader = mountHeader(ThemeEditorHeader, {
				onReset: () => resetFn(),
				onExport: () => exportFn?.() ?? "",
			});
		}
		sidepanel.open({
			title: "Color Editor",
			bodyNode: editor.node,
			headerNode: editorHeader!.node,
			key: "color-editor",
		});
	};

	async function editTheme(key: string) {
		if (activeThemeKey !== key) {
			if (isUserTheme(key)) {
				await selectUserTheme(key);
			} else {
				await selectTheme(key);
			}
		}
		openColorEditor();
	}

	async function selectTheme(key: string) {
		if (applyingTheme) {
			return;
		}
		applyingTheme = key;
		try {
			// setAutoTheme applies it only when the slot matches the system's current mode.
			if (autoSwitch) {
				await setAutoTheme(slot, key);
			} else {
				activeThemeKey = key;
				await setValue(ctx.key, key);
				await applyThemeByKey(key, ctx.defaultValue);
			}
		} finally {
			applyingTheme = null;
		}
	}

	function getRepoOwner(repo: string): string {
		return repo.split("/")[0] ?? repo;
	}

	function formatToken(key: string): string {
		return key
			.replace(/^--color-/, "")
			.replace(/([A-Z])/g, " $1")
			.replace(/^(.)/, (c) => c.toUpperCase())
			.trim();
	}

	const q = $derived(searchQuery.trim().toLowerCase());

	const featuredRank = (key: string) => {
		const i = FEATURED_THEMES.indexOf(key);
		return i === -1 ? FEATURED_THEMES.length : i;
	};
	const filteredBuiltin = $derived(
		Object.entries(themes)
			.filter(([, theme]) => {
				const matchesSearch = !q || theme.name.toLowerCase().includes(q);
				const matchesThemeType = themeFilter === "all" || theme.mode === themeFilter;
				return matchesSearch && matchesThemeType;
			})
			.sort(([a], [b]) => featuredRank(a) - featuredRank(b)),
	);
	// Actual's own theme follows the system, so it belongs under either mode.
	const showNative = $derived(!q || "actual default native no theme".includes(q));
	const builtinKeys = $derived([
		...(showNative ? [NATIVE_THEME_KEY] : []),
		...filteredBuiltin.map(([key]) => key),
	]);

	const filteredCommunity = $derived(
		remoteThemes.filter((theme) => {
			// Search covers makers too, in place of the old creator filter.
			const matchesSearch =
				!q ||
				theme.name.toLowerCase().includes(q) ||
				getRepoOwner(theme.repo).toLowerCase().includes(q);
			const matchesThemeType = themeFilter === "all" || theme.mode === themeFilter;
			return matchesSearch && matchesThemeType;
		}),
	);

	const filteredUser = $derived(
		Object.values(userThemeState.themes).filter(
			(t) =>
				(!q || t.name.toLowerCase().includes(q)) &&
				(themeFilter === "all" || t.mode === themeFilter),
		),
	);
	const isEmpty = $derived(
		!showNative &&
			filteredUser.length === 0 &&
			filteredBuiltin.length === 0 &&
			filteredCommunity.length === 0 &&
			!loadingRemote,
	);

	// ── Community: collapsed unless asked for, in use, or matched by a search ──
	const COMMUNITY_OPEN_KEY = "theme-picker-community-open";
	let communityOpen = $state(false);
	const usingCommunity = $derived(
		isCommunityTheme(activeThemeKey) ||
			(autoSwitch && (isCommunityTheme(autoDarkKey) || isCommunityTheme(autoLightKey))),
	);
	const communityShown = $derived(
		communityOpen || usingCommunity || (q !== "" && filteredCommunity.length > 0),
	);
	function toggleCommunity() {
		communityOpen = !communityShown;
		void setValue(COMMUNITY_OPEN_KEY, communityOpen);
	}

	// ── Thumbnails ──
	let communityThumbs = $state<Record<string, Thumb>>({});
	$effect(() => {
		if (!communityShown) {
			return;
		}
		for (const theme of filteredCommunity) {
			if (communityThumbs[theme.repo]) {
				continue;
			}
			void communityThumb(theme.repo, theme.mode).then((thumb) => {
				if (thumb) {
					communityThumbs[theme.repo] = thumb;
				}
			});
		}
	});
	function modeOf(key: string): "light" | "dark" {
		if (isUserTheme(key)) {
			return userThemeState.themes[key]?.mode ?? "dark";
		}
		if (themes[key]) {
			return themes[key].mode;
		}
		return remoteThemes.find((t) => t.repo === key)?.mode ?? (systemIsDark ? "dark" : "light");
	}
	function thumbFor(key: string): Thumb {
		if (key === NATIVE_THEME_KEY) {
			return nativeThumb(nativeColors, systemIsDark ? "dark" : "light");
		}
		if (isUserTheme(key)) {
			const theme = userThemeState.themes[key];
			return theme ? userThumb(theme) : placeholderThumb("dark");
		}
		return builtinThumb(key) ?? communityThumbs[key] ?? placeholderThumb(modeOf(key));
	}

	// ── Actions ──
	/** The one way into editing a theme: the studio where it can go, else the color editor. */
	function customize(key: string) {
		if (isUserTheme(key)) {
			editUserTheme(key);
		} else if (themes[key]) {
			openPaletteInStudio(themes[key].keys, themes[key].name);
		} else {
			void editTheme(key);
		}
	}
	function editedTokens(key: string): string[] {
		return Object.keys(editorState.overrides[key] ?? {}).map(formatToken);
	}
	function actionsFor(key: string): CardAction[] {
		const list: CardAction[] = [{ label: "Customize", onselect: () => customize(key) }];
		// Studio and palette themes get the studio from Customize; token overrides stay one step away.
		if (isUserTheme(key) || themes[key]) {
			list.push({ label: "Edit individual colors", onselect: () => void editTheme(key) });
		}
		if (isCommunityTheme(key)) {
			list.push({ label: "View on GitHub", href: `https://github.com/${key}` });
		}
		if (isUserTheme(key)) {
			list.push({ label: "Delete", danger: true, onselect: () => void handleCreatorDelete(key) });
		}
		return list;
	}

	let creator: Mounted | null = null;
	let creatorHeader: Mounted | null = null;
	let creatorThemeId = "";
	let creatorThemeName = "My Theme";
	let creatorThemeMode: "dark" | "light" = "dark";
	let creatorPaletteKeys: Record<string, string> = {};
	let creatorCss = "";
	let creatorType: "palette" | "css" = "palette";

	function openCreator(existingId?: string) {
		const existing = existingId ? userThemeState.themes[existingId] : null;
		creatorThemeId = existing?.id ?? generateThemeId();
		creatorThemeName = existing?.name ?? "My Theme";
		creatorThemeMode = existing?.mode ?? "dark";
		creatorType = existing?.type ?? "palette";
		creatorPaletteKeys = existing?.keys ? { ...existing.keys } : {};
		creatorCss = existing?.css ?? "";

		if (existing && existing.type === "palette" && existing.keys) {
			applyUserPaletteTheme(existing.id, existing.keys);
		}

		creator?.destroy();
		creatorHeader?.destroy();
		creator = mountToPanelBody(ThemeCreator, {
			initialKeys: creatorPaletteKeys,
			initialCss: creatorCss,
			initialTab: creatorType,
			onPaletteChange: (keys: Record<string, string>) => {
				creatorPaletteKeys = keys;
				creatorType = "palette";
			},
			onCssApply: (css: string) => {
				creatorCss = css;
				creatorType = "css";
				applyUserCSSTheme(creatorThemeId, css);
			},
		});
		creatorHeader = mountHeader(ThemeCreatorHeader, {
			themeName: creatorThemeName,
			mode: creatorThemeMode,
			isEditing: !!existing,
			onSave: handleCreatorSave,
			onDelete: () => handleCreatorDelete(creatorThemeId),
			onNameChange: (name: string) => {
				creatorThemeName = name;
			},
			onModeChange: (mode: "dark" | "light") => {
				creatorThemeMode = mode;
			},
		});
		sidepanel.open({
			title: "Create Theme",
			bodyNode: creator.node,
			headerNode: creatorHeader.node,
			key: "theme-creator",
		});
	}

	async function handleCreatorSave() {
		const theme: UserTheme = {
			id: creatorThemeId,
			name: creatorThemeName,
			mode: creatorThemeMode,
			type: creatorType,
			...(creatorType === "palette" ? { keys: { ...creatorPaletteKeys } } : { css: creatorCss }),
		};
		await saveUserTheme(theme);
		activeThemeKey = theme.id;
		if (autoSwitch) {
			await setAutoTheme(systemIsDark ? "dark" : "light", theme.id);
		} else {
			await setValue(ctx.key, theme.id);
		}
		sidepanel.close("theme-creator");
	}

	async function handleCreatorDelete(id: string) {
		await deleteUserTheme(id);
		sidepanel.close("theme-creator");
		if (activeThemeKey === id) {
			activeThemeKey = ctx.defaultValue;
			await setValue(ctx.key, ctx.defaultValue);
			await applyThemeByKey(ctx.defaultValue, ctx.defaultValue);
		}
	}

	function editUserTheme(id: string) {
		const theme = userThemeState.themes[id];
		if (theme?.recipe || theme?.type === "palette") {
			openThemeStudio(id);
		} else {
			openCreator(id);
		}
	}

	async function selectUserTheme(id: string) {
		if (userThemeState.themes[id]) {
			await selectTheme(id);
		}
	}

	// The titlebar's gallery and this card can both change the theme; each follows the other's changes.
	$effect(() => {
		const stops = [
			watchValue<boolean>("theme-auto-switch", (v) => (autoSwitch = !!v)),
			watchValue<string>("theme-auto-dark", (v) => v && (autoDarkKey = v)),
			watchValue<string>("theme-auto-light", (v) => v && (autoLightKey = v)),
			watchValue<string>(ctx.key, (v) => {
				if (v && !autoSwitch) {
					activeThemeKey = v;
				}
			}),
		];
		return () => stops.forEach((stop) => stop());
	});

	onMount(async () => {
		nativeColors = getNativePreviewColors();
		communityOpen = await getValue<boolean>(COMMUNITY_OPEN_KEY, false);
		await loadUserThemes();

		autoSwitch = await getValue<boolean>("theme-auto-switch", false);
		autoDarkKey = (await getValue<string>("theme-auto-dark", DEFAULT_THEME)) as string;
		autoLightKey = (await getValue<string>("theme-auto-light", "latte")) as string;

		slot = systemIsDark ? "dark" : "light";
		if (autoSwitch) {
			activeThemeKey = systemIsDark ? autoDarkKey : autoLightKey;
		} else {
			activeThemeKey = (await getValue<string>(ctx.key, ctx.defaultValue)) as string;
		}

		if (galleryOnly) {
			openGallery(null);
		}

		loadingRemote = true;
		try {
			remoteThemes = await fetchCommunityThemeCatalog();
		} catch (r) {
			log.warn("fetch error", r);
			remoteError = true;
		}
		loadingRemote = false;
	});
</script>

<div class="picker">
	{#if !galleryOnly}
		{#snippet modeSwitch()}
			<div class="abt-seg abt-seg--sm" role="group" aria-label="Theme mode" {@attach inHeader}>
				<button type="button" aria-pressed={!autoSwitch} onclick={() => setMatchSystem(false)}>
					One theme
				</button>
				<button type="button" aria-pressed={autoSwitch} onclick={() => setMatchSystem(true)}>
					Match system
				</button>
			</div>
		{/snippet}

		{@render modeSwitch()}

		{#snippet currentRow(mode: "light" | "dark" | null, key: string)}
			<div class="now">
				<span class="now-thumb"><ThemeThumb thumb={thumbFor(key)} /></span>
				<span class="now-text">
					<span class="now-label">
						{#if mode}
							{mode === "dark" ? "Dark" : "Light"}
							{#if (mode === "dark") === systemIsDark}<span class="now-badge">Now</span>{/if}
						{:else}
							{modeOf(key) === "dark" ? "Dark theme" : "Light theme"}
						{/if}
					</span>
					<span class="now-name">{getThemeName(key)}</span>
				</span>
				<span class="now-actions">
					<button type="button" class="abt-btn abt-btn--sm" onclick={() => customize(key)}>
						<Paintbrush size={14} /> Customize
					</button>
					<button type="button" class="abt-btn abt-btn--sm" onclick={() => openGallery(mode)}>
						<LayoutGrid size={14} /> Change theme
					</button>
				</span>
			</div>
		{/snippet}

		{#if autoSwitch}
			{@render currentRow("light", autoLightKey)}
			{@render currentRow("dark", autoDarkKey)}
		{:else}
			{@render currentRow(null, activeThemeKey)}
		{/if}

		<div class="style-row">
			<span class="now-text">
				<span class="now-name">Style</span>
				<span class="now-label"
					>Corners, background, glow and grain, and other details for every theme</span
				>
			</span>
			<button type="button" class="abt-btn abt-btn--sm" onclick={openStylePanel}>
				<Shapes size={14} /> Edit style
			</button>
		</div>
	{/if}

	{#snippet showAll(id: string, total: number, limit: number)}
		{#if !q && !expanded[id] && total > limit}
			<button type="button" class="show-all" onclick={() => (expanded[id] = true)}>
				Show all {total}
			</button>
		{/if}
	{/snippet}

	<!-- Rendered here for its state, shown in the side panel. -->
	{#if galleryOpen}
		<div class="gallery" {@attach inPanel}>
			{#if autoSwitch}
				<div class="abt-seg abt-seg--sm slots" role="group" aria-label="Theme to choose">
					{#each [["light", "Light theme"], ["dark", "Dark theme"]] as const as [mode, label] (mode)}
						<button type="button" aria-pressed={slot === mode} onclick={() => pickSlot(mode)}
							>{label}</button
						>
					{/each}
				</div>
			{/if}
			<div class="controls">
				<input
					class="abt-input search"
					type="search"
					placeholder="Search themes and makers…"
					bind:value={searchQuery}
				/>
				<div class="abt-seg abt-seg--sm" role="group" aria-label="Light or dark themes">
					{#each [["all", "All"], ["dark", "Dark"], ["light", "Light"]] as [value, label] (value)}
						<button
							type="button"
							aria-pressed={themeFilter === value}
							onclick={() => (themeFilter = value)}>{label}</button
						>
					{/each}
				</div>
			</div>

			{#if isEmpty}
				<p class="status">No themes match your search.</p>
			{/if}

			{#if !q || filteredUser.length}
				<section class="group">
					<span class="section-label">My themes</span>
					<div class="grid">
						{#if !q}
							<button type="button" class="create" onclick={() => openThemeStudio()}>
								<span class="create-frame"><Plus size={18} /></span>
								<span class="create-label">Create in Studio</span>
							</button>
						{/if}
						{#each visible("user", filteredUser, (t) => t.id, PREVIEW - 1) as theme (theme.id)}
							<ThemeCard
								name={theme.name}
								thumb={thumbFor(theme.id)}
								mode={theme.mode}
								active={selectedKey === theme.id}
								edited={editedTokens(theme.id)}
								actions={actionsFor(theme.id)}
								onselect={() => selectUserTheme(theme.id)}
							/>
						{/each}
					</div>
					{@render showAll("user", filteredUser.length, PREVIEW - 1)}
				</section>
			{/if}

			{#if builtinKeys.length}
				<section class="group">
					<span class="section-label">Built-in</span>
					<div class="grid">
						{#each visible("builtin", builtinKeys, (k) => k) as key (key)}
							{#if key === NATIVE_THEME_KEY}
								<ThemeCard
									name="Actual default"
									thumb={thumbFor(NATIVE_THEME_KEY)}
									active={selectedKey === NATIVE_THEME_KEY}
									edited={editedTokens(NATIVE_THEME_KEY)}
									actions={[
										{
											label: "Edit individual colors",
											onselect: () => void editTheme(NATIVE_THEME_KEY),
										},
									]}
									onselect={() => selectTheme(NATIVE_THEME_KEY)}
								/>
							{:else}
								<ThemeCard
									name={themes[key].name}
									thumb={thumbFor(key)}
									mode={themes[key].mode}
									active={selectedKey === key}
									edited={editedTokens(key)}
									actions={actionsFor(key)}
									onselect={() => selectTheme(key)}
								/>
							{/if}
						{/each}
					</div>
					{@render showAll("builtin", builtinKeys.length, PREVIEW)}
				</section>
			{/if}

			{#if remoteThemes.length || loadingRemote || remoteError}
				<section class="group">
					<button
						type="button"
						class="community-head"
						aria-expanded={communityShown}
						onclick={toggleCommunity}
					>
						<span class="chevron" class:open={communityShown}><ChevronRight size={14} /></span>
						<span class="section-label">Community</span>
						{#if !loadingRemote && !remoteError}<span class="count">{filteredCommunity.length}</span
							>{/if}
					</button>
					{#if communityShown}
						{#if loadingRemote}
							<p class="status">Loading community themes…</p>
						{:else if remoteError}
							<p class="status error">Couldn't load community themes.</p>
						{:else}
							<div class="grid">
								{#each visible("community", filteredCommunity, (t) => t.repo) as theme (theme.repo)}
									<ThemeCard
										name={theme.name}
										thumb={thumbFor(theme.repo)}
										mode={theme.mode}
										creator={getRepoOwner(theme.repo)}
										active={selectedKey === theme.repo}
										loading={applyingTheme === theme.repo}
										disabled={applyingTheme !== null}
										edited={editedTokens(theme.repo)}
										actions={actionsFor(theme.repo)}
										onselect={() => selectTheme(theme.repo)}
									/>
								{/each}
							</div>
							{@render showAll("community", filteredCommunity.length, PREVIEW)}
						{/if}
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-5);
		width: 100%;
	}
	.section-label {
		font-size: var(--abt-text-xs);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--abt-soft);
	}

	/* ── Current ── */
	/* The name and buttons sit beside the thumbnail; the buttons wrap under each other if they must. */
	.now {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-areas:
			"thumb text"
			"thumb actions";
		align-content: start;
		gap: var(--abt-space-3) var(--abt-space-5);
	}
	.now-thumb {
		grid-area: thumb;
	}
	.now-text {
		grid-area: text;
	}
	.now-actions {
		grid-area: actions;
	}
	.style-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--abt-space-3) var(--abt-space-5);
		padding-top: var(--abt-space-5);
		border-top: 1px solid var(--abt-line);
	}
	.style-row .now-text {
		flex: 1 1 200px;
	}
	.style-row .abt-btn {
		gap: var(--abt-space-2);
	}
	.now + .now {
		padding-top: var(--abt-space-5);
		border-top: 1px solid var(--abt-line);
	}
	.now-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--abt-space-3);
	}
	.now-actions .abt-btn {
		gap: var(--abt-space-2);
		white-space: nowrap;
	}
	.now-thumb {
		width: 104px;
		overflow: hidden;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
	}
	.now-text {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
	}
	.now-label {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		font-size: var(--abt-text-xs);
		color: var(--abt-soft);
	}
	.now-badge {
		padding: 0 var(--abt-space-2);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent-2);
		color: var(--abt-accent-text);
		font-weight: 600;
	}
	.now-name {
		overflow: hidden;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/* ── Gallery ── */
	.gallery {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-6);
		padding: var(--abt-space-4) 12px var(--abt-space-6); /* raw: matches panel Section's gutter */
	}
	.slots {
		align-self: flex-start;
	}
	.show-all {
		align-self: flex-start;
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-accent-text);
		font: inherit;
		font-size: var(--abt-text-sm);
		cursor: pointer;
	}
	.show-all:hover {
		text-decoration: underline;
	}

	/* ── Controls ── */
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--abt-space-3);
		margin-bottom: calc(-1 * var(--abt-space-2));
	}
	.search {
		flex: 1;
		min-width: 180px;
	}

	/* ── Grids ── */
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--abt-space-6) var(--abt-space-4);
	}
	.create {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-accent-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.create-frame {
		display: grid;
		place-items: center;
		aspect-ratio: 16 / 10;
		border: 1px dashed var(--abt-ink-5);
		border-radius: var(--abt-radius);
		transition:
			border-color 0.12s,
			color 0.12s;
	}
	.create:hover .create-frame {
		border-color: var(--abt-accent);
	}
	.create-label {
		height: 20px;
		font-size: var(--abt-text-sm);
		font-weight: 500;
		line-height: 20px;
	}

	/* ── Community ── */
	.community-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--abt-space-2);
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-soft);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.community-head:hover .section-label {
		color: var(--abt-ink);
	}
	.chevron {
		display: inline-flex;
		transition: transform 0.12s;
	}
	.chevron.open {
		transform: rotate(90deg);
	}
	.count {
		font-size: var(--abt-text-xs);
		font-variant-numeric: tabular-nums;
	}
	.status {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
	}
	.status.error {
		color: var(--color-errorText);
	}
	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
