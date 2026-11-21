<script lang="ts" module>
	/** `glyph` is a curated line icon, as `glyph:<name>`, drawn in the text colour wherever it shows. */
	export type IconPickerResult =
		| { type: "emoji"; value: string }
		| { type: "url"; value: string }
		| { type: "dataUrl"; value: string }
		| { type: "glyph"; value: string };
</script>

<script lang="ts">
	import { onOutsideClick } from "@lib/dom/popover";
	import { getFaviconUrl } from "@lib/dom/favicon";
	import {
		Flag,
		Globe,
		Image,
		Lightbulb,
		PawPrint,
		Pizza,
		Plane,
		Search,
		Shapes,
		Smile,
		Upload,
		User,
		Volleyball,
		X,
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import Tabs from "./Tabs.svelte";
	import GlyphIcon from "./GlyphIcon.svelte";
	import { GLYPHS } from "@lib/glyphs";
	import { GLYPH_PREFIX } from "@lib/glyph-icons";
	import emojiData from "unicode-emoji-json/data-by-group.json";

	const {
		anchorRect,
		hasIcon = false,
		glyphs = false,
		onSelect,
		onRemove,
		onClose,
	}: {
		anchorRect: DOMRect;
		hasIcon?: boolean;
		/** Offers the curated line icons, for callers that draw them themed. */
		glyphs?: boolean;
		onSelect: (result: IconPickerResult) => void;
		onRemove?: () => void;
		onClose: () => void;
	} = $props();

	type Tab = "emoji" | "icons" | "logo" | "upload";
	const TABS: { value: Tab; label: string; icon: typeof Smile }[] = $derived([
		{ value: "emoji", label: "Emoji", icon: Smile },
		...(glyphs ? [{ value: "icons" as Tab, label: "Icons", icon: Shapes }] : []),
		{ value: "logo", label: "Logo", icon: Image },
		{ value: "upload", label: "Upload", icon: Upload },
	]);

	// ── Icons ──
	let glyphSearch = $state("");
	// Each typed word must start one of the icon's words; whole-word matches come first, so "fun"
	// puts the ticket before "fund".
	const shownGlyphs = $derived.by(() => {
		const typed = glyphSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
		if (!typed.length) {
			return GLYPHS;
		}
		const ranked: { glyph: (typeof GLYPHS)[number]; exact: number }[] = [];
		for (const glyph of GLYPHS) {
			const words = `${glyph.name.replace(/-/g, " ")} ${glyph.words}`.split(" ");
			if (typed.every((t) => words.some((w) => w.startsWith(t)))) {
				ranked.push({ glyph, exact: typed.filter((t) => words.includes(t)).length });
			}
		}
		return ranked.sort((a, b) => b.exact - a.exact).map((r) => r.glyph);
	});
	let activeTab = $state<Tab>("emoji");
	let popoverEl = $state<HTMLElement>();
	let style = $state("opacity:0");

	// ── Logo ──
	let domain = $state("");
	let logoUrl = $state<string | null>(null);
	let logoLoaded = $state(false);
	let logoError = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function fetchLogo(d = domain) {
		const clean = d.trim().toLowerCase();
		if (!clean) {
			logoUrl = null;
			logoLoaded = false;
			logoError = false;
			return;
		}
		const url = getFaviconUrl(clean);
		// Same src fires no new load event, so resetting would leave the logo unclickable.
		if (url === logoUrl) {
			return;
		}
		logoUrl = url;
		logoLoaded = false;
		logoError = false;
	}

	function onDomainInput() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => fetchLogo(), 400);
	}

	// ── Emoji ──
	interface EmojiEntry {
		emoji: string;
		name: string;
		slug: string;
		skin_tone_support: boolean;
	}
	interface EmojiGroup {
		name: string;
		emojis: EmojiEntry[];
	}
	const groups: EmojiGroup[] = emojiData as EmojiGroup[];
	const GROUP_ICONS: Record<string, typeof Smile> = {
		"Smileys & Emotion": Smile,
		"People & Body": User,
		"Animals & Nature": PawPrint,
		"Food & Drink": Pizza,
		"Travel & Places": Plane,
		Activities: Volleyball,
		Objects: Lightbulb,
		Symbols: Shapes,
		Flags: Flag,
	};
	let emojiSearch = $state("");
	let activeGroup = $state(groups[0]?.name ?? "");
	let gridWrap = $state<HTMLElement>();
	let emojiObserver: IntersectionObserver | null = null;

	const filteredEmoji = $derived.by(() => {
		const q = emojiSearch.trim().toLowerCase();
		if (!q) {
			return null;
		}
		const results: EmojiEntry[] = [];
		for (const g of groups) {
			for (const e of g.emojis) {
				if (e.name.includes(q) || e.slug.includes(q)) {
					results.push(e);
				}
				if (results.length >= 80) {
					return results;
				}
			}
		}
		return results;
	});

	function scrollToGroup(name: string) {
		activeGroup = name;
		emojiSearch = "";
		gridWrap
			?.querySelector(`[data-group="${name}"]`)
			?.scrollIntoView({ block: "start", behavior: "smooth" });
	}

	$effect(() => {
		if (activeTab !== "emoji" || !gridWrap) {
			return;
		}
		emojiObserver?.disconnect();
		emojiObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeGroup = (entry.target as HTMLElement).dataset.group ?? activeGroup;
					}
				}
			},
			{ root: gridWrap, threshold: 0, rootMargin: "0px 0px -80% 0px" },
		);
		for (const el of gridWrap.querySelectorAll<HTMLElement>("[data-group]")) {
			emojiObserver.observe(el);
		}
		return () => emojiObserver?.disconnect();
	});

	// ── Upload ──
	let uploadedDataUrl = $state<string | null>(null);
	let isDragOver = $state(false);
	let fileInputEl = $state<HTMLInputElement | null>(null);

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			readFile(file);
		}
	}

	function readFile(file: File) {
		if (!file.type.startsWith("image/")) {
			return;
		}
		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedDataUrl = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	// ── Positioning ──
	onMount(async () => {
		await new Promise((r) => requestAnimationFrame(r));
		if (!popoverEl) {
			return;
		}
		const pop = popoverEl.getBoundingClientRect();
		const margin = 8;
		let top = anchorRect.top;
		let left = anchorRect.right + margin;

		if (left + pop.width > window.innerWidth - margin) {
			left = anchorRect.left - pop.width - margin;
		}
		if (top + pop.height > window.innerHeight - margin) {
			top = window.innerHeight - pop.height - margin;
		}
		top = Math.max(margin, top);

		style = `top:${top}px;left:${left}px;opacity:1`;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			onClose();
		}
	}

	$effect(() => {
		if (popoverEl) {
			return onOutsideClick(popoverEl, onClose);
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="pop abt-popover" {style} bind:this={popoverEl} role="dialog" aria-label="Icon picker">
	<Tabs tabs={TABS} bind:value={activeTab} --abt-tabs-bg="none" --abt-tabs-pad="var(--abt-space-3)">
		{#snippet trailing()}
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
				onclick={onClose}
				aria-label="Close"
			>
				<X size={14} />
			</button>
		{/snippet}
	</Tabs>

	<!-- Emoji -->
	{#if activeTab === "emoji"}
		<div class="pane pane--emoji">
			<label class="search">
				<Search size={14} class="search__icon" />
				<input
					class="search__input"
					type="text"
					placeholder="Search emoji…"
					bind:value={emojiSearch}
				/>
			</label>
			{#if !emojiSearch.trim()}
				<div class="eg-tabs">
					{#each groups as g (g.name)}
						{@const GroupIcon = GROUP_ICONS[g.name] ?? Shapes}
						<button
							type="button"
							class="eg-tab"
							class:active={activeGroup === g.name}
							title={g.name}
							aria-label={g.name}
							onclick={() => scrollToGroup(g.name)}
						>
							<GroupIcon size={15} />
						</button>
					{/each}
				</div>
			{/if}
			<div class="eg-grid-wrap" bind:this={gridWrap}>
				{#if filteredEmoji}
					<div class="eg-grid">
						{#each filteredEmoji as e, i (i)}
							<button
								class="eg-btn"
								title={e.name}
								onclick={() => onSelect({ type: "emoji", value: e.emoji })}>{e.emoji}</button
							>
						{/each}
					</div>
					{#if filteredEmoji.length === 0}<p class="hint hint--empty">No results</p>{/if}
				{:else}
					{#each groups as g (g.name)}
						<div data-group={g.name}>
							<div class="eg-label">{g.name}</div>
							<div class="eg-grid">
								{#each g.emojis as e, i (i)}
									{#if !e.skin_tone_support || !e.name.includes("skin tone")}
										<button
											class="eg-btn"
											title={e.name}
											onclick={() => onSelect({ type: "emoji", value: e.emoji })}>{e.emoji}</button
										>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Icons -->
	{:else if activeTab === "icons"}
		<div class="pane pane--emoji">
			<label class="search">
				<Search size={14} class="search__icon" />
				<input
					class="search__input"
					type="text"
					placeholder="Search icons…"
					bind:value={glyphSearch}
				/>
			</label>
			<div class="eg-grid-wrap">
				<div class="eg-grid">
					{#each shownGlyphs as g (g.name)}
						<button
							class="eg-btn eg-btn--glyph"
							title={g.name.replace(/-/g, " ")}
							aria-label={g.name.replace(/-/g, " ")}
							onclick={() => onSelect({ type: "glyph", value: GLYPH_PREFIX + g.name })}
						>
							<GlyphIcon glyph={g} size={18} />
						</button>
					{/each}
				</div>
				{#if shownGlyphs.length === 0}<p class="hint hint--empty">No results</p>{/if}
			</div>
		</div>

		<!-- Logo -->
	{:else if activeTab === "logo"}
		<div class="pane pane--logo">
			<label class="search">
				<Globe size={14} class="search__icon" />
				<input
					class="search__input"
					type="text"
					placeholder="bankofamerica.com"
					bind:value={domain}
					oninput={onDomainInput}
					onkeydown={(e) => e.key === "Enter" && fetchLogo()}
				/>
			</label>
			{#if logoUrl}
				<button
					class="logo-preview"
					class:loaded={logoLoaded}
					class:error={logoError}
					disabled={!logoLoaded}
					onclick={() => logoLoaded && onSelect({ type: "url", value: logoUrl! })}
				>
					{#if logoError}
						<span class="logo-preview__err">No logo found</span>
					{:else}
						<img
							src={logoUrl}
							alt="logo"
							onload={() => {
								logoLoaded = true;
								logoError = false;
							}}
							onerror={() => {
								logoLoaded = false;
								logoError = true;
							}}
						/>
						{#if logoLoaded}<span class="logo-preview__hint">Click to use</span>{/if}
					{/if}
				</button>
			{:else}
				<p class="hint">Type a domain name to fetch its logo</p>
			{/if}
		</div>

		<!-- Upload -->
	{:else}
		<div class="pane pane--upload">
			<input
				type="file"
				accept="image/*"
				class="sr-only"
				bind:this={fileInputEl}
				onchange={(e) => {
					const f = (e.target as HTMLInputElement).files?.[0];
					if (f) {
						readFile(f);
					}
				}}
			/>
			<div
				class="dropzone"
				class:over={isDragOver}
				role="button"
				tabindex="0"
				onclick={() => fileInputEl?.click()}
				onkeydown={(e) => e.key === "Enter" && fileInputEl?.click()}
				ondragover={(e) => {
					e.preventDefault();
					isDragOver = true;
				}}
				ondragleave={() => (isDragOver = false)}
				ondrop={handleDrop}
			>
				{#if uploadedDataUrl}
					<img src={uploadedDataUrl} alt="preview" class="dropzone__img" />
					<span class="dropzone__hint">Click to replace</span>
				{:else}
					<Upload size={20} class="dropzone__icon" />
					<span class="dropzone__label">Drop image or click to browse</span>
				{/if}
			</div>
			{#if uploadedDataUrl}
				<button
					type="button"
					class="abt-btn abt-tone-accent wide"
					onclick={() => onSelect({ type: "dataUrl", value: uploadedDataUrl! })}
					>Use this image</button
				>
			{/if}
		</div>
	{/if}

	<!-- Footer -->
	{#if hasIcon && onRemove}
		<div class="footer">
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-btn--ghost abt-tone-danger wide"
				onclick={onRemove}>Remove icon</button
			>
		</div>
	{/if}
</div>

<style>
	.pop {
		position: fixed;
		z-index: 10001;
		width: 280px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: opacity 0.15s;
	}

	.pane {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		padding: 0 var(--abt-space-3) var(--abt-space-3);
	}
	.pane--upload {
		padding-top: var(--abt-space-3);
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		margin: 0 calc(-1 * var(--abt-space-3));
		padding: var(--abt-space-4);
		border-bottom: 1px solid var(--abt-ink-2);
		cursor: text;
	}
	.search :global(.search__icon) {
		flex-shrink: 0;
		color: var(--abt-subtle);
	}
	.search__input {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: none;
		outline: none;
		background: transparent;
		font: inherit;
		font-size: var(--abt-text-md);
		color: var(--abt-ink);
	}
	.search__input::placeholder {
		color: var(--abt-subtle);
	}

	/* ── Emoji ── */
	.eg-tabs {
		display: flex;
		gap: var(--abt-space-1);
	}

	.eg-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--abt-space-2) 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-subtle);
		cursor: pointer;
		transition:
			color 0.08s,
			background 0.08s;
	}

	.eg-tab:hover {
		color: var(--abt-ink);
		background: var(--abt-ink-2);
	}
	.eg-tab.active {
		color: var(--abt-accent);
		background: var(--abt-accent-2);
	}
	.eg-tab:focus-visible,
	.eg-btn:focus-visible {
		outline: 2px solid var(--abt-accent-4);
		outline-offset: -2px;
	}

	.eg-grid-wrap {
		max-height: 220px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--abt-ink-5) transparent;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	.eg-label {
		font-size: var(--abt-text-2xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--abt-soft);
		padding: 4px 2px 3px;
		position: sticky;
		top: 0;
		background: var(--abt-popover-bg);
		z-index: 1;
	}

	.eg-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 1px;
	}

	.eg-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		transition: background 0.08s;
	}

	.eg-btn:hover {
		background: var(--abt-accent-2);
	}
	/* Line icons in the text colour while picking, so their shapes are easy to tell apart. */
	.eg-btn--glyph :global(.glyph-icon) {
		color: var(--color-pageText);
	}

	/* ── Logo ── */
	.logo-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: var(--abt-space-4);
		border-radius: var(--abt-radius);
		border: 1px solid var(--abt-ink-2);
		background: var(--abt-ink-1);
		cursor: default;
		min-height: 84px;
		transition:
			background 0.15s,
			border-color 0.15s;
		width: 100%;
	}

	.logo-preview.loaded {
		cursor: pointer;
		border-color: var(--abt-accent);
		background: var(--abt-accent-1);
	}
	.logo-preview.loaded:hover {
		background: var(--abt-accent-2);
	}
	.logo-preview img {
		width: 48px;
		height: 48px;
		object-fit: contain;
		border-radius: var(--abt-radius-sm);
	}
	.logo-preview__hint {
		font-size: var(--abt-text-xs);
		color: var(--abt-accent);
		font-weight: 500;
	}
	.logo-preview__err {
		font-size: var(--abt-text-sm);
		color: var(--color-errorText);
	}

	/* ── Upload ── */
	.dropzone {
		border: 1px dashed var(--abt-ink-4);
		border-radius: var(--abt-radius);
		min-height: 104px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
		padding: var(--abt-space-4);
	}

	.dropzone:hover,
	.dropzone.over {
		border-color: var(--abt-accent);
		background: var(--abt-accent-1);
	}
	.dropzone :global(.dropzone__icon) {
		color: var(--abt-subtle);
	}
	.dropzone__label {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
		text-align: center;
	}
	.dropzone__img {
		max-width: 100%;
		max-height: 80px;
		object-fit: contain;
		border-radius: var(--abt-radius-sm);
	}
	.dropzone__hint {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}

	/* ── Footer ── */
	.footer {
		padding: 6px 10px 8px;
		border-top: 1px solid var(--abt-ink-2);
	}

	/* ── Shared ── */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.hint {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
		margin: 0;
		padding: var(--abt-space-2) 0;
	}
	.hint--empty {
		padding: var(--abt-space-4);
		text-align: center;
	}

	.wide {
		width: 100%;
	}
</style>
