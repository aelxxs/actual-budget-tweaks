<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { themes } from "@lib/design";
	import { getValue, setValue } from "@lib/utilities/store";
	import { mountToNode, mountToPanelBody } from "@lib/utilities/svelte";
	import { onDestroy, onMount } from "svelte";
	import { sidepanel } from "../core/side-panel";
	import { DEFAULT_THEME } from "./defaults";
	import { editorState, resetFn, setResetFn } from "./editor-state.svelte";
	import {
		applyPalette,
		applyThemeByKey,
		applyUserCSSTheme,
		applyUserPaletteTheme,
		fetchCommunityThemeCatalog,
		getBuiltinPreviewColors,
		getNativePreviewColors,
		isCommunityTheme,
		NATIVE_THEME_KEY,
		type RemoteTheme,
	} from "./theme-apply";
	import ThemeColorEditor from "./ThemeColorEditor.svelte";
	import ThemeCreator from "./ThemeCreator.svelte";
	import ThemeCreatorHeader from "./ThemeCreatorHeader.svelte";
	import ThemeEditorHeader from "./ThemeEditorHeader.svelte";
	import {
		deleteUserTheme,
		generateThemeId,
		getPreviewColorsFromTheme,
		isUserTheme,
		loadUserThemes,
		saveUserTheme,
		userThemeState,
		type UserTheme,
	} from "./user-themes.svelte";

	let { ctx }: { ctx: { key: string; defaultValue: string } } = $props();

	let activeThemeKey = $state(ctx.defaultValue);
	let applyingTheme = $state<string | null>(null);
	let remoteThemes = $state<RemoteTheme[]>([]);
	let loadingRemote = $state(false);
	let remoteError = $state(false);
	let searchQuery = $state("");
	let creatorFilter = $state("all");
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

	function getThemeName(key: string): string {
		if (key === NATIVE_THEME_KEY) return "Actual default";
		if (themes[key]) return themes[key].name;
		if (isUserTheme(key)) return userThemeState.themes[key]?.name ?? key;
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
		if (on === autoSwitch) return;
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
	}

	function slotPreview(key: string): string[] {
		if (key === NATIVE_THEME_KEY) return nativeColors.slice(0, 4);
		if (isUserTheme(key)) {
			const theme = userThemeState.themes[key];
			return theme ? getPreviewColorsFromTheme(theme).slice(0, 4) : [];
		}
		const remote = remoteThemes.find((t) => t.repo === key);
		return (remote?.colors ?? getBuiltinPreviewColors(key)).slice(0, 4);
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

	let editorNode: Node | null = null;
	let headerNode: Node | null = null;

	let exportFn: (() => string) | null = null;

	const openColorEditor = () => {
		if (!editorNode) {
			editorNode = mountToPanelBody(ThemeColorEditor, {
				onReady: ({ reset, getExportCSS }: { reset: () => void; getExportCSS: () => string }) => {
					setResetFn(reset);
					exportFn = getExportCSS;
				},
			}).node;
			headerNode = mountToNode(ThemeEditorHeader, {
				onReset: () => resetFn(),
				onExport: () => exportFn?.() ?? "",
			});
		}
		sidepanel.open({
			title: "Color Editor",
			bodyNode: editorNode,
			headerNode: headerNode,
		});
	};

	async function editTheme(key: string, e: Event) {
		e.stopPropagation();
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
		if (applyingTheme) return;
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

	let expandedCards = $state(new Set<string>());

	function toggleExpanded(key: string, e: MouseEvent | KeyboardEvent) {
		e.stopPropagation();
		const next = new Set(expandedCards);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedCards = next;
	}

	const q = $derived(searchQuery.trim().toLowerCase());

	const filteredBuiltin = $derived(
		Object.entries(themes).filter(([, theme]) => {
			const matchesSearch = !q || theme.name.toLowerCase().includes(q);
			const matchesCreator = creatorFilter === "all" || creatorFilter === "ABT";
			const matchesThemeType = themeFilter === "all" || theme.mode === themeFilter;

			return matchesSearch && matchesCreator && matchesThemeType;
		}),
	);
	const showNative = $derived(
		(!q || "actual default native no theme".includes(q)) &&
			themeFilter === "all" &&
			(creatorFilter === "all" || creatorFilter === "ABT"),
	);

	const filteredCommunity = $derived(
		remoteThemes.filter((theme) => {
			const matchesSearch = !q || theme.name.toLowerCase().includes(q);
			const matchesCreator =
				creatorFilter === "all" ||
				(creatorFilter !== "ABT" && getRepoOwner(theme.repo) === creatorFilter);
			const matchesThemeType = themeFilter === "all" || theme.mode === themeFilter;

			return matchesSearch && matchesCreator && matchesThemeType;
		}),
	);

	const availableCreators = $derived([
		"ABT",
		...Array.from(new Set(remoteThemes.map((t) => getRepoOwner(t.repo)))).sort(),
	]);

	const isEmpty = $derived(
		!showNative && filteredBuiltin.length === 0 && filteredCommunity.length === 0 && !loadingRemote,
	);

	let creatorNode: Node | null = null;
	let creatorHeaderNode: Node | null = null;
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

		creatorNode = mountToPanelBody(ThemeCreator, {
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
		}).node;
		creatorHeaderNode = mountToNode(ThemeCreatorHeader, {
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
			bodyNode: creatorNode,
			headerNode: creatorHeaderNode,
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
		sidepanel.close();
	}

	async function handleCreatorDelete(id: string) {
		await deleteUserTheme(id);
		sidepanel.close();
		if (activeThemeKey === id) {
			activeThemeKey = ctx.defaultValue;
			await setValue(ctx.key, ctx.defaultValue);
			applyPalette(ctx.defaultValue);
		}
	}

	function editUserTheme(id: string, e: Event) {
		e.stopPropagation();
		openCreator(id);
	}

	async function selectUserTheme(id: string) {
		if (userThemeState.themes[id]) await selectTheme(id);
	}

	async function handleDeleteFromCard(id: string, e: Event) {
		e.stopPropagation();
		await handleCreatorDelete(id);
	}

	onMount(async () => {
		nativeColors = getNativePreviewColors();
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

		loadingRemote = true;
		try {
			remoteThemes = await fetchCommunityThemeCatalog();
		} catch (r) {
			console.warn("[ABT Themes] fetch error", r);
			remoteError = true;
		}
		loadingRemote = false;
	});
</script>

<div class="customizer">
	<div class="mode">
		<div class="abt-seg" role="group" aria-label="Theme mode">
			<button type="button" aria-pressed={!autoSwitch} onclick={() => setMatchSystem(false)}>
				One theme
			</button>
			<button type="button" aria-pressed={autoSwitch} onclick={() => setMatchSystem(true)}>
				Match system
			</button>
		</div>
		{#if autoSwitch}
			<div class="slots">
				{#each [{ mode: "light", label: "Light", key: autoLightKey }, { mode: "dark", label: "Dark", key: autoDarkKey }] as s (s.mode)}
					{@const mode = s.mode as "light" | "dark"}
					<button
						type="button"
						class="slot"
						class:slot--target={slot === mode}
						aria-pressed={slot === mode}
						onclick={() => pickSlot(mode)}
					>
						<span class="slot__swatches" aria-hidden="true">
							{#each slotPreview(s.key) as color, i (i)}
								<span style="background: {color}"></span>
							{/each}
						</span>
						<span class="slot__text">
							<span class="slot__mode">
								{s.label}
								{#if (mode === "dark") === systemIsDark}<span class="slot__now">Now</span>{/if}
							</span>
							<span class="slot__name">{getThemeName(s.key)}</span>
						</span>
					</button>
				{/each}
			</div>
			<p class="mode__hint">
				Choosing a theme below sets your {slot} theme.
			</p>
		{/if}
	</div>

	<div class="controls">
		<input
			class="abt-input controls__search"
			type="search"
			placeholder="Search themes…"
			bind:value={searchQuery}
		/>
		<div class="abt-seg" role="group" aria-label="Theme kind">
			{#each [["all", "All"], ["dark", "Dark"], ["light", "Light"]] as [value, label] (value)}
				<button
					type="button"
					aria-pressed={themeFilter === value}
					onclick={() => (themeFilter = value)}
				>
					{label}
				</button>
			{/each}
		</div>
		{#if availableCreators.length > 2}
			<select class="abt-input" bind:value={creatorFilter} aria-label="Creator">
				<option value="all">All creators</option>
				{#each availableCreators as creator, i (i)}
					<option value={creator}>{creator === "ABT" ? "ABT (Built-in)" : creator}</option>
				{/each}
			</select>
		{/if}
		<button
			type="button"
			class="abt-btn controls__new"
			onclick={() => openCreator()}
			title="Create a theme"
		>
			<Icon name="plus" size={14} strokeWidth={2} />
			New
		</button>
	</div>

	<div class="gallery">
		{#if isEmpty}
			<p class="gallery__empty">No themes match your filters.</p>
		{:else}
			{#if Object.keys(userThemeState.themes).length > 0}
				<div class="gallery__section">
					<div class="gallery__section-label">My Themes</div>
					<div class="gallery__grid">
						{#each Object.values(userThemeState.themes) as uTheme (uTheme.id)}
							{@const isActive = selectedKey === uTheme.id}
							{@const previewColors = getPreviewColorsFromTheme(uTheme)}
							<button
								class="card"
								class:card--active={isActive}
								onclick={() => selectUserTheme(uTheme.id)}
								title={uTheme.name}
							>
								{#if previewColors.length > 0}
									<div class="card__swatches">
										{#each previewColors as color, i (i)}
											<div class="swatch" style="background: {color};"></div>
										{/each}
									</div>
								{:else}
									<div class="card__swatches card__swatches--placeholder">
										<div class="swatch" style="background: var(--color-pageBackground);"></div>
									</div>
								{/if}
								<div class="card__body">
									<div class="card__name">{uTheme.name}</div>
									<div class="card__badges">
										<span class="badge badge--mode badge--{uTheme.mode}">{uTheme.mode}</span>
										<span class="badge badge--creator">Custom</span>
									</div>
									<div class="card__meta">
										<span class="card__source">{uTheme.type === "palette" ? "Palette" : "CSS"}</span
										>
										<div class="card__actions">
											<div
												class="card__edit-btn"
												role="button"
												tabindex="0"
												title="Edit palette for {uTheme.name}"
												onclick={(e) => editUserTheme(uTheme.id, e)}
												onkeydown={(e) =>
													(e.key === "Enter" || e.key === " ") && editUserTheme(uTheme.id, e)}
											>
												<Icon name="pencil" size={12} />
											</div>
											<div
												class="card__edit-btn"
												role="button"
												tabindex="0"
												title="Edit color tokens for {uTheme.name}"
												onclick={(e) => editTheme(uTheme.id, e)}
												onkeydown={(e) =>
													(e.key === "Enter" || e.key === " ") && editTheme(uTheme.id, e)}
											>
												<svg
													viewBox="0 0 16 16"
													fill="none"
													stroke="currentColor"
													stroke-width="1.3"
													stroke-linecap="round"
													stroke-linejoin="round"
													aria-hidden="true"
													><rect x="1.5" y="1.5" width="5" height="5" rx="1" /><rect
														x="9.5"
														y="1.5"
														width="5"
														height="5"
														rx="1"
													/><rect x="1.5" y="9.5" width="5" height="5" rx="1" /><rect
														x="9.5"
														y="9.5"
														width="5"
														height="5"
														rx="1"
													/></svg
												>
											</div>
											<div
												class="card__delete-btn"
												role="button"
												tabindex="0"
												title="Delete {uTheme.name}"
												onclick={(e) => handleDeleteFromCard(uTheme.id, e)}
												onkeydown={(e) =>
													(e.key === "Enter" || e.key === " ") &&
													handleDeleteFromCard(uTheme.id, e)}
											>
												<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
													><path
														d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM6.5 1.75v1.25h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25ZM4.997 6.178a.75.75 0 1 0-1.493.144l.684 7.082A1.75 1.75 0 0 0 5.926 15h4.146a1.75 1.75 0 0 0 1.739-1.596l.684-7.082a.75.75 0 0 0-1.494-.144l-.684 7.082a.25.25 0 0 1-.249.228H5.927a.25.25 0 0 1-.25-.228l-.683-7.082Z"
													/></svg
												>
											</div>
										</div>
									</div>
								</div>
								{#if isActive}
									<div class="card__check" aria-label="Active theme">✓</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if showNative || filteredBuiltin.length > 0}
				<div class="gallery__section">
					<div class="gallery__section-label">Built-in</div>
					<div class="gallery__grid">
						{#if showNative}
							<button
								class="card"
								class:card--active={selectedKey === NATIVE_THEME_KEY}
								onclick={() => selectTheme(NATIVE_THEME_KEY)}
								title="Use Actual Budget's default theme"
							>
								<div class="card__swatches">
									{#each nativeColors as color, i (i)}
										<div class="swatch" style="background: {color};"></div>
									{/each}
								</div>
								<div class="card__body">
									<div class="card__name">Actual default</div>
									<div class="card__badges">
										<span class="badge badge--creator">Actual</span>
									</div>
									<div class="card__meta">
										<span class="card__source">Follows Actual's own theme setting</span>
									</div>
								</div>
								{#if selectedKey === NATIVE_THEME_KEY}
									<div class="card__check" aria-label="Active theme">✓</div>
								{/if}
							</button>
						{/if}
						{#each filteredBuiltin as [key, theme] (key)}
							{@const previewColors = getBuiltinPreviewColors(key)}
							{@const isActive = selectedKey === key}
							<button
								class="card"
								class:card--active={isActive}
								onclick={() => selectTheme(key)}
								title={theme.name}
							>
								<div class="card__swatches">
									{#each previewColors as color, i (i)}
										<div class="swatch" style="background: {color};"></div>
									{/each}
								</div>
								<div class="card__body">
									<div class="card__name">{theme.name}</div>
									<div class="card__badges">
										<span class="badge badge--mode badge--{theme.mode}">{theme.mode}</span>
										<span class="badge badge--creator">ABT</span>
									</div>
									<div class="card__meta">
										<span class="card__source">Built-in</span>
										<div
											class="card__edit-btn"
											role="button"
											tabindex="0"
											title="Edit colors for {theme.name}"
											onclick={(e) => editTheme(key, e)}
											onkeydown={(e) => (e.key === "Enter" || e.key === " ") && editTheme(key, e)}
										>
											<Icon name="pencil" size={12} />
										</div>
									</div>
								</div>
								{#if Object.keys(editorState.overrides[key] ?? {}).length > 0}
									{@const editedTokens = Object.keys(editorState.overrides[key] ?? {})}
									{@const isExpanded = expandedCards.has(key)}
									<div
										role="button"
										tabindex="0"
										class="card__edits-toggle"
										onclick={(e) => toggleExpanded(key, e)}
										onkeydown={(e) =>
											(e.key === "Enter" || e.key === " ") && toggleExpanded(key, e)}
									>
										<span
											>✎ {editedTokens.length} token{editedTokens.length !== 1 ? "s" : ""} edited</span
										>
										<span class="card__edits-chevron" class:is-open={isExpanded}>▾</span>
									</div>
									{#if isExpanded}
										<ul class="card__edits-list">
											{#each editedTokens as token (token)}
												<li>{formatToken(token)}</li>
											{/each}
										</ul>
									{/if}
								{/if}
								{#if isActive}
									<div class="card__check" aria-label="Active theme">✓</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if filteredCommunity.length > 0 || loadingRemote || remoteError}
				<div class="gallery__section">
					<div class="gallery__section-label">Community</div>
					{#if loadingRemote}
						<p class="gallery__status">Loading community themes…</p>
					{:else if remoteError}
						<p class="gallery__status gallery__status--error">Could not load community themes.</p>
					{:else}
						<div class="gallery__grid">
							{#each filteredCommunity as theme, i (i)}
								{@const isActive = selectedKey === theme.repo}
								{@const isLoading = applyingTheme === theme.repo}
								<button
									class="card"
									class:card--active={isActive}
									class:card--loading={isLoading}
									disabled={applyingTheme !== null}
									onclick={() => selectTheme(theme.repo)}
									title={theme.name}
								>
									<div class="card__swatches">
										{#each theme.colors.slice(0, 6) as color, i (i)}
											<div class="swatch" style="background: {color};"></div>
										{/each}
									</div>
									<div class="card__body">
										<div class="card__name">{theme.name}</div>
										<div class="card__badges">
											<span class="badge badge--mode badge--{theme.mode}">{theme.mode}</span>
											<span class="badge badge--creator">{getRepoOwner(theme.repo)}</span>
										</div>
										<div class="card__meta">
											<a
												class="card__source card__source--link"
												href="https://github.com/{theme.repo}"
												target="_blank"
												rel="noopener noreferrer"
												onclick={(e) => e.stopPropagation()}
											>
												github.com/{theme.repo} ↗
											</a>
											<div
												class="card__edit-btn"
												role="button"
												tabindex="0"
												title="Edit colors for {theme.name}"
												onclick={(e) => editTheme(theme.repo, e)}
												onkeydown={(e) =>
													(e.key === "Enter" || e.key === " ") && editTheme(theme.repo, e)}
											>
												<Icon name="pencil" size={12} />
											</div>
										</div>
									</div>
									{#if Object.keys(editorState.overrides[theme.repo] ?? {}).length > 0}
										{@const editedTokens = Object.keys(editorState.overrides[theme.repo] ?? {})}
										{@const isExpanded = expandedCards.has(theme.repo)}
										<div
											role="button"
											tabindex="0"
											class="card__edits-toggle"
											onclick={(e) => toggleExpanded(theme.repo, e)}
											onkeydown={(e) =>
												(e.key === "Enter" || e.key === " ") && toggleExpanded(theme.repo, e)}
										>
											<span
												>✎ {editedTokens.length} token{editedTokens.length !== 1 ? "s" : ""} edited</span
											>
											<span class="card__edits-chevron" class:is-open={isExpanded}>▾</span>
										</div>
										{#if isExpanded}
											<ul class="card__edits-list">
												{#each editedTokens as token (token)}
													<li>{formatToken(token)}</li>
												{/each}
											</ul>
										{/if}
									{/if}
									{#if isLoading}
										<div class="card__spinner" aria-label="Loading"></div>
									{:else if isActive}
										<div class="card__check" aria-label="Active theme">✓</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.customizer {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: var(--abt-space-4);
	}

	/* ── Mode and slots ─────────────────────────────────────────────── */

	.mode {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
	}

	.mode > .abt-seg {
		align-self: flex-start;
	}

	.slots {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--abt-space-3);
	}

	.slot {
		display: flex;
		align-items: center;
		gap: var(--abt-space-4);
		padding: var(--abt-space-3);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: var(--abt-fill);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.1s,
			background 0.1s;
	}

	.slot:hover {
		background: var(--abt-fill-hover);
	}

	.slot--target {
		border-color: var(--abt-accent);
		background: var(--abt-accent-1);
	}

	.slot__swatches {
		display: grid;
		grid-template-columns: repeat(2, 16px);
		grid-auto-rows: 16px;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: var(--abt-radius-sm);
		border: 1px solid var(--abt-line);
	}

	.slot__text {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
	}

	.slot__mode {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
	}

	.slot__now {
		padding: 1px var(--abt-space-2);
		border-radius: var(--abt-radius-pill);
		font-size: var(--abt-text-xs);
		background: var(--abt-accent-2);
		color: var(--abt-accent);
		letter-spacing: 0;
		text-transform: none;
	}

	.slot__name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--abt-text-lg);
		font-weight: 500;
	}

	.mode__hint {
		margin: 0;
		font-size: var(--abt-text-md);
		color: var(--color-pageTextSubdued);
	}

	/* ── Filters ────────────────────────────────────────────────────── */

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--abt-space-3);
	}

	/* Search gets its own line; the filters and New share the one below. */
	.controls__search {
		flex: 1 1 100%;
	}

	.controls__new {
		margin-left: auto;
	}

	.gallery {
		max-height: 440px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		scrollbar-width: thin;
	}

	.gallery__section-label {
		font-size: var(--abt-text-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
		margin-bottom: 8px;
		font-weight: 600;
		position: sticky;
		top: 0;
		z-index: 1;
		/* The settings section's card surface (.abt-card). */
		background: var(--abt-panel-surface);
		padding: 4px 0;
		margin: -4px 0 4px;
	}

	.gallery__grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}

	.gallery__empty,
	.gallery__status {
		font-size: var(--abt-text-base);
		color: var(--color-pageTextSubdued);
		padding: 4px 0;
		margin: 0;
	}

	.gallery__status--error {
		color: var(--color-errorText);
	}

	/* ── Cards ────────────────────────────────────────────────────────── */

	.card {
		background: var(--color-cardBackground);
		border: var(--border);
		border-radius: var(--abt-radius);
		cursor: pointer;
		padding: 0;
		overflow: hidden;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
		text-align: left;
		position: relative;
		display: flex;
		flex-direction: column;
		font-family: inherit;
	}

	.card:hover:not(:disabled) {
		border-color: var(--abt-accent-4);
		box-shadow: 0 2px 8px var(--abt-accent-2);
	}

	.card--active {
		border-color: var(--abt-accent);
		box-shadow: 0 0 0 2px var(--abt-accent-3);
	}

	.card--loading {
		pointer-events: none;
		opacity: 0.7;
	}

	.card__swatches {
		display: flex;
		height: 30px;
		flex-shrink: 0;
	}

	.swatch {
		flex: 1;
	}

	.card__body {
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.card__name {
		font-size: var(--abt-text-base);
		font-weight: 600;
		color: var(--color-pageText);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card__badges {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	/* ── Badges ───────────────────────────────────────────────────────── */

	.badge {
		font-size: var(--abt-text-2xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 2px 5px;
		border-radius: var(--abt-radius-sm);
		font-weight: 600;
		border: 1px solid transparent;
	}

	/* Mode badges use fixed hues so they're readable regardless of active theme */
	.badge--dark {
		background: rgba(100, 80, 180, 0.15);
		color: color-mix(in srgb, rgb(100, 80, 180) 60%, var(--color-pageText));
		border-color: rgba(100, 80, 180, 0.25);
	}

	.badge--light {
		background: rgba(180, 130, 30, 0.15);
		color: color-mix(in srgb, rgb(180, 130, 30) 55%, var(--color-pageText));
		border-color: rgba(180, 130, 30, 0.25);
	}

	/* Creator badge uses the theme's own accent so it stays on-brand */
	.badge--creator {
		background: var(--abt-accent-2);
		color: var(--abt-accent);
		border-color: var(--abt-accent-3);
	}

	/* ── Card details ─────────────────────────────────────────────────── */

	.card__source {
		font-size: var(--abt-text-2xs);
		color: var(--color-pageTextSubdued);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card__source--link {
		color: var(--color-pageTextLink);
		text-decoration: none;
	}

	.card__source--link:hover {
		text-decoration: underline;
	}

	.card__check {
		position: absolute;
		top: 5px;
		right: 5px;
		width: 17px;
		height: 17px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent);
		color: var(--color-pageBackground);
		font-size: var(--abt-text-xs);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		line-height: 1;
	}

	/* ── Token-edit indicator ─────────────────────────────────────────── */

	.card__edits-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 5px 10px;
		border: none;
		border-top: 1px solid var(--abt-accent-2);
		background: var(--abt-accent-1);
		color: var(--abt-accent);
		font-family: inherit;
		font-size: var(--abt-text-2xs);
		letter-spacing: 0.04em;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.card__edits-toggle:hover {
		background: var(--abt-accent-2);
	}

	.card__edits-chevron {
		transition: transform 0.15s;
		display: inline-block;
	}

	.card__edits-chevron.is-open {
		transform: rotate(-180deg);
	}

	.card__edits-list {
		list-style: none;
		margin: 0;
		padding: 4px 10px 6px;
		border-top: 1px solid var(--abt-accent-2);
		background: var(--abt-accent-1);
		max-height: 88px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.card__edits-list li {
		font-size: var(--abt-text-2xs);
		color: var(--color-pageTextSubdued);
		padding: 1px 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card__edits-list li::before {
		content: "·  ";
		color: var(--abt-accent);
	}

	.card__spinner {
		position: absolute;
		top: 5px;
		right: 5px;
		width: 15px;
		height: 15px;
		border-radius: var(--abt-radius-pill);
		border: 2px solid var(--abt-accent-3);
		border-top-color: var(--abt-accent);
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Card meta row ────────────────────────────────────────────────── */

	.card__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
	}

	.card__edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--abt-radius-sm);
		cursor: pointer;
		color: var(--color-pageTextSubdued);
		flex-shrink: 0;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.card__edit-btn:hover {
		color: var(--abt-accent);
		background: var(--abt-accent-2);
	}

	.card__edit-btn svg {
		width: 12px;
		height: 12px;
	}

	.card__actions {
		display: flex;
		gap: 2px;
	}

	.card__delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--abt-radius-sm);
		cursor: pointer;
		color: var(--color-pageTextSubdued);
		flex-shrink: 0;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.card__delete-btn:hover {
		color: var(--color-errorText);
		background: color-mix(in srgb, var(--color-errorText) 12%, transparent);
	}

	.card__delete-btn svg {
		width: 12px;
		height: 12px;
	}
</style>
