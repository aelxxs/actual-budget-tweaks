<script lang="ts">
	import { themes } from "@lib/design";
	import { getValue, setValue } from "@lib/utilities/store";
	import { mountToNode } from "@lib/utilities/svelte";
	import { onMount } from "svelte";
	import { sidepanel } from "../core/side-panel";
	import ThemeColorEditor from "./ThemeColorEditor.svelte";
	import ThemeEditorHeader from "./ThemeEditorHeader.svelte";
	import { editorState, resetFn, setResetFn } from "./editor-state.svelte";
	import { applyCommunityTheme, applyPalette, isCommunityTheme } from "./theme-apply";

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

	const openColorEditor = () => {
		if (!editorNode) {
			editorNode = mountToNode(ThemeColorEditor, {
				onReady: ({ reset }: { reset: () => void }) => setResetFn(reset),
			});
			headerNode = mountToNode(ThemeEditorHeader, { onReset: () => resetFn() });
		}
		sidepanel.open({
			title: "Color Editor",
			bodyNode: editorNode,
			headerNode: headerNode,
		});
	};

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

	onMount(async () => {
		activeThemeKey = (await getValue<string>(ctx.key, ctx.defaultValue)) as string;

		loadingRemote = true;
		try {
			const res = await fetch(
				"https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/data/customThemeCatalog.json",
			);
			if (res.ok) {
				remoteThemes = await res.json();
			} else {
				remoteError = true;
			}
		} catch {
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

	<div class="gallery">
		{#if isEmpty}
			<p class="gallery__empty">No themes match your filters.</p>
		{:else}
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
									<div class="card__source">Built-in</div>
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
										<a
											class="card__source card__source--link"
											href="https://github.com/{theme.repo}"
											target="_blank"
											rel="noopener noreferrer"
											onclick={(e) => e.stopPropagation()}
										>
											github.com/{theme.repo} ↗
										</a>
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

	<div class="customizer__footer">
		<button class="customizer__edit-btn" onclick={openColorEditor}>
			<span aria-hidden="true">◈</span> Customize Colors
		</button>
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

	/* ── Footer ───────────────────────────────────────────────────────── */

	.customizer__footer {
		display: flex;
	}

	.customizer__edit-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		justify-content: center;
		font-family: inherit;
		font-size: 11px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 7px 12px;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--color-sidebarItemAccentSelected) 35%, transparent);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 8%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.customizer__edit-btn:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 16%, transparent);
		border-color: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 65%, transparent);
	}
</style>
