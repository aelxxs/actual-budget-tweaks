<script lang="ts">
	import { themes } from "@lib/design";
	import { getValue, setValue } from "@lib/utilities/store";
	import { mountToNode } from "@lib/utilities/svelte";
	import { onMount } from "svelte";
	import { sidepanel } from "../core/side-panel";
	import ThemeColorEditor from "./ThemeColorEditor.svelte";
	import ThemeEditorHeader from "./ThemeEditorHeader.svelte";
	import { editorState, resetFn, setResetFn } from "./editor-state.svelte";
	import { applyCommunityTheme, applyPalette, applyUserPaletteTheme, applyUserCSSTheme, isCommunityTheme } from "./theme-apply";
	import ThemeCreator from "./ThemeCreator.svelte";
	import ThemeCreatorHeader from "./ThemeCreatorHeader.svelte";
	import {
		userThemeState,
		loadUserThemes,
		saveUserTheme,
		deleteUserTheme,
		generateThemeId,
		isUserTheme,
		getPreviewColorsFromTheme,
		type UserTheme,
	} from "./user-themes.svelte";

	type RemoteTheme = {
		name: string;
		repo: string;
		colors: string[];
		mode: "light" | "dark";
	};

	let { ctx }: { ctx: { key: string; defaultValue: string } } = $props();

	let activeThemeKey = $state(ctx.defaultValue);
	let applyingTheme = $state<string | null>(null);
	let remoteThemes = $state<RemoteTheme[]>([]);
	let loadingRemote = $state(false);
	let remoteError = $state(false);
	let searchQuery = $state("");
	let creatorFilter = $state("all");
	let themeFilter = $state("all");

	let editorNode: Node | null = null;
	let headerNode: Node | null = null;

	let exportFn: (() => string) | null = null;

	const openColorEditor = () => {
		if (!editorNode) {
			editorNode = mountToNode(ThemeColorEditor, {
				onReady: ({ reset, getExportCSS }: { reset: () => void; getExportCSS: () => string }) => {
					setResetFn(reset);
					exportFn = getExportCSS;
				},
			});
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

	function getPreviewColors(themeKey: string): string[] {
		const theme = themes[themeKey];
		if (!theme) return [];
		const k = theme.keys;
		return [
			k["--ctp-base"],
			k["--ctp-mantle"],
			k["--ctp-surface0"],
			k["--ctp-text"],
			k["--ctp-mauve"],
			k["--ctp-blue"],
		].filter(Boolean) as string[];
	}

	async function selectTheme(key: string) {
		if (applyingTheme) return;
		applyingTheme = key;
		activeThemeKey = key;
		try {
			await setValue(ctx.key, key);
			if (isCommunityTheme(key)) {
				await applyCommunityTheme(key);
			} else {
				applyPalette(key);
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

	const filteredCommunity = $derived(
		remoteThemes.filter((theme) => {
			const matchesSearch = !q || theme.name.toLowerCase().includes(q);
			const matchesCreator =
				creatorFilter === "all" || (creatorFilter !== "ABT" && getRepoOwner(theme.repo) === creatorFilter);
			const matchesThemeType = themeFilter === "all" || theme.mode === themeFilter;

			return matchesSearch && matchesCreator && matchesThemeType;
		}),
	);

	const availableCreators = $derived([
		"ABT",
		...Array.from(new Set(remoteThemes.map((t) => getRepoOwner(t.repo)))).sort(),
	]);

	const isEmpty = $derived(filteredBuiltin.length === 0 && filteredCommunity.length === 0 && !loadingRemote);

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

		creatorNode = mountToNode(ThemeCreator, {
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
		creatorHeaderNode = mountToNode(ThemeCreatorHeader, {
			themeName: creatorThemeName,
			mode: creatorThemeMode,
			isEditing: !!existing,
			onSave: handleCreatorSave,
			onDelete: () => handleCreatorDelete(creatorThemeId),
			onNameChange: (name: string) => { creatorThemeName = name; },
			onModeChange: (mode: "dark" | "light") => { creatorThemeMode = mode; },
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
		await setValue(ctx.key, theme.id);
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
		if (applyingTheme) return;
		const theme = userThemeState.themes[id];
		if (!theme) return;
		applyingTheme = id;
		activeThemeKey = id;
		try {
			await setValue(ctx.key, id);
			if (theme.type === "palette" && theme.keys) {
				applyUserPaletteTheme(id, theme.keys);
			} else if (theme.type === "css" && theme.css) {
				applyUserCSSTheme(id, theme.css);
			}
		} finally {
			applyingTheme = null;
		}
	}

	async function handleDeleteFromCard(id: string, e: Event) {
		e.stopPropagation();
		await handleCreatorDelete(id);
	}

	onMount(async () => {
		await loadUserThemes();
		activeThemeKey = (await getValue<string>(ctx.key, ctx.defaultValue)) as string;

		loadingRemote = true;
		try {
			const res = await browser.runtime.sendMessage({
				type: "fetch",
				responseType: "json",
				url: "https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/data/customThemeCatalog.json",
			});
			if (res?.ok) {
				remoteThemes = res.data;
			} else {
				remoteError = true;
			}
		} catch (r) {
			console.log({ r });
			remoteError = true;
		}
		loadingRemote = false;
	});
</script>

<div class="customizer">
	<div class="controls">
		<input class="controls__search" type="search" placeholder="Search themes…" bind:value={searchQuery} />
		<select class="controls__creator" bind:value={creatorFilter}>
			<option value="all">All creators</option>
			{#each availableCreators as creator}
				<option value={creator}>{creator === "ABT" ? "ABT (Built-in)" : creator}</option>
			{/each}
		</select>
		<select class="controls__creator" bind:value={themeFilter}>
			<option value="all">All themes</option>
			<option value="dark">Dark</option>
			<option value="light">Light</option>
		</select>
	</div>

	<button class="create-theme-btn" onclick={() => openCreator()}>
		<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>
		Create Theme
	</button>

	<div class="gallery">
		{#if isEmpty}
			<p class="gallery__empty">No themes match your filters.</p>
		{:else}
			{#if Object.keys(userThemeState.themes).length > 0}
				<div class="gallery__section">
					<div class="gallery__section-label">My Themes</div>
					<div class="gallery__grid">
						{#each Object.values(userThemeState.themes) as uTheme (uTheme.id)}
							{@const isActive = activeThemeKey === uTheme.id}
							{@const previewColors = getPreviewColorsFromTheme(uTheme)}
							<button
								class="card"
								class:card--active={isActive}
								onclick={() => selectUserTheme(uTheme.id)}
								title={uTheme.name}
							>
								{#if previewColors.length > 0}
									<div class="card__swatches">
										{#each previewColors as color}
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
										<span class="card__source">{uTheme.type === "palette" ? "Palette" : "CSS"}</span>
										<div class="card__actions">
											<div
												class="card__edit-btn"
												role="button"
												tabindex="0"
												title="Edit palette for {uTheme.name}"
												onclick={(e) => editUserTheme(uTheme.id, e)}
												onkeydown={(e) => (e.key === "Enter" || e.key === " ") && editUserTheme(uTheme.id, e)}
											>
												<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064l6.286-6.286Z"/></svg>
											</div>
											<div
												class="card__edit-btn"
												role="button"
												tabindex="0"
												title="Edit color tokens for {uTheme.name}"
												onclick={(e) => editTheme(uTheme.id, e)}
												onkeydown={(e) => (e.key === "Enter" || e.key === " ") && editTheme(uTheme.id, e)}
											>
												<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>
											</div>
											<div
												class="card__delete-btn"
												role="button"
												tabindex="0"
												title="Delete {uTheme.name}"
												onclick={(e) => handleDeleteFromCard(uTheme.id, e)}
												onkeydown={(e) => (e.key === "Enter" || e.key === " ") && handleDeleteFromCard(uTheme.id, e)}
											>
												<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM6.5 1.75v1.25h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25ZM4.997 6.178a.75.75 0 1 0-1.493.144l.684 7.082A1.75 1.75 0 0 0 5.926 15h4.146a1.75 1.75 0 0 0 1.739-1.596l.684-7.082a.75.75 0 0 0-1.494-.144l-.684 7.082a.25.25 0 0 1-.249.228H5.927a.25.25 0 0 1-.25-.228l-.683-7.082Z"/></svg>
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

			{#if filteredBuiltin.length > 0}
				<div class="gallery__section">
					<div class="gallery__section-label">Built-in</div>
					<div class="gallery__grid">
						{#each filteredBuiltin as [key, theme]}
							{@const previewColors = getPreviewColors(key)}
							{@const isActive = activeThemeKey === key}
							<button
								class="card"
								class:card--active={isActive}
								onclick={() => selectTheme(key)}
								title={theme.name}
							>
								<div class="card__swatches">
									{#each previewColors as color}
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
											<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
												><path
													d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064l6.286-6.286Z"
												/></svg
											>
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
											{#each editedTokens as token}
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
							{#each filteredCommunity as theme}
								{@const isActive = activeThemeKey === theme.repo}
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
										{#each theme.colors.slice(0, 6) as color}
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
												<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
													><path
														d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064l6.286-6.286Z"
													/></svg
												>
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
												{#each editedTokens as token}
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
		padding-top: 4px;
		gap: 8px;
	}

	/* ── Create Theme Button ─────────────────────────────────────────── */

	.create-theme-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		font-family: inherit;
		font-size: 11px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 7px 12px;
		border-radius: 8px;
		border: 1px dashed color-mix(in srgb, var(--color-sidebarItemAccentSelected) 50%, transparent);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 5%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.create-theme-btn:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, transparent);
		border-color: var(--color-sidebarItemAccentSelected);
	}

	.create-theme-btn svg {
		width: 14px;
		height: 14px;
	}

	/* ── Controls ─────────────────────────────────────────────────────── */

	.controls {
		display: flex;
		gap: 6px;
	}

	.controls__search,
	.controls__creator {
		font-family: inherit;
		font-size: 12px;
		padding: 5px 8px;
		border-radius: 6px;
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		outline: none;
		transition: border-color 0.15s;
	}

	.controls__search {
		flex: 1;
		min-width: 0;
	}

	.controls__search::placeholder {
		color: var(--color-formInputTextPlaceholder);
	}

	.controls__search:focus,
	.controls__creator:focus {
		border-color: var(--color-formInputBorderSelected);
	}

	.controls__creator {
		flex-shrink: 0;
		cursor: pointer;
	}

	/* ── Gallery ──────────────────────────────────────────────────────── */

	.gallery {
		max-height: 440px;
		overflow-y: auto;
		border: var(--border);
		border-radius: 8px;
		background: var(--color-pageBackground);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		scrollbar-width: thin;
	}

	.gallery__section-label {
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
		margin-bottom: 8px;
		font-weight: 600;
	}

	.gallery__grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}

	.gallery__empty,
	.gallery__status {
		font-size: 12px;
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
		border-radius: 8px;
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
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 60%, transparent);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent);
	}

	.card--active {
		border-color: var(--color-sidebarItemAccentSelected);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-sidebarItemAccentSelected) 25%, transparent);
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
		font-size: 12px;
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
		font-size: 9px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 2px 5px;
		border-radius: 4px;
		font-weight: 600;
		border: 1px solid transparent;
	}

	/* Mode badges use fixed hues so they're readable regardless of active theme */
	.badge--dark {
		background: rgba(100, 80, 180, 0.15);
		color: #7c68d4;
		border-color: rgba(100, 80, 180, 0.25);
	}

	.badge--light {
		background: rgba(180, 130, 30, 0.15);
		color: #b08020;
		border-color: rgba(180, 130, 30, 0.25);
	}

	/* Creator badge uses the theme's own accent so it stays on-brand */
	.badge--creator {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 30%, transparent);
	}

	/* ── Card details ─────────────────────────────────────────────────── */

	.card__source {
		font-size: 9px;
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
		border-radius: 50%;
		background: var(--color-sidebarItemAccentSelected);
		color: var(--color-pageBackground);
		font-size: 10px;
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
		border-top: 1px solid color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 6%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-family: inherit;
		font-size: 9px;
		letter-spacing: 0.04em;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.card__edits-toggle:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, transparent);
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
		border-top: 1px solid color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 4%, transparent);
		max-height: 88px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.card__edits-list li {
		font-size: 9px;
		color: var(--color-pageTextSubdued);
		padding: 1px 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card__edits-list li::before {
		content: "·  ";
		color: var(--color-sidebarItemAccentSelected);
	}

	.card__spinner {
		position: absolute;
		top: 5px;
		right: 5px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, var(--color-sidebarItemAccentSelected) 30%, transparent);
		border-top-color: var(--color-sidebarItemAccentSelected);
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
		border-radius: 4px;
		cursor: pointer;
		color: var(--color-pageTextSubdued);
		flex-shrink: 0;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.card__edit-btn:hover {
		color: var(--color-sidebarItemAccentSelected);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, transparent);
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
		border-radius: 4px;
		cursor: pointer;
		color: var(--color-pageTextSubdued);
		flex-shrink: 0;
		transition: color 0.15s, background 0.15s;
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
