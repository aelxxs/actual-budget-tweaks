<script lang="ts">
	import { getFaviconUrl } from "@lib/utilities/favicon";
	import { onMount } from "svelte";
	import emojiData from "unicode-emoji-json/data-by-group.json";

	export type IconPickerResult =
		| { type: "emoji"; value: string }
		| { type: "url"; value: string }
		| { type: "dataUrl"; value: string };

	const {
		anchorRect,
		hasIcon = false,
		onSelect,
		onRemove,
		onClose,
	} = $props<{
		anchorRect: DOMRect;
		hasIcon?: boolean;
		onSelect: (result: IconPickerResult) => void;
		onRemove?: () => void;
		onClose: () => void;
	}>();

	type Tab = "emoji" | "logo" | "upload";
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
		logoUrl = getFaviconUrl(clean);
		logoLoaded = false;
		logoError = false;
	}

	function onDomainInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
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
	const GROUP_ICONS: Record<string, string> = {
		"Smileys & Emotion": "😀",
		"People & Body": "🧑",
		"Animals & Nature": "🐶",
		"Food & Drink": "🍕",
		"Travel & Places": "✈️",
		Activities: "⚽",
		Objects: "💡",
		Symbols: "💱",
		Flags: "🏳️",
	};
	let emojiSearch = $state("");
	let activeGroup = $state(groups[0]?.name ?? "");
	let gridWrap = $state<HTMLElement>();
	let emojiObserver: IntersectionObserver | null = null;

	const filteredEmoji = $derived.by(() => {
		const q = emojiSearch.trim().toLowerCase();
		if (!q) return null;
		const results: EmojiEntry[] = [];
		for (const g of groups) {
			for (const e of g.emojis) {
				if (e.name.includes(q) || e.slug.includes(q)) results.push(e);
				if (results.length >= 80) return results;
			}
		}
		return results;
	});

	function scrollToGroup(name: string) {
		activeGroup = name;
		emojiSearch = "";
		gridWrap?.querySelector(`[data-group="${name}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
	}

	$effect(() => {
		if (activeTab !== "emoji" || !gridWrap) return;
		emojiObserver?.disconnect();
		emojiObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) activeGroup = (entry.target as HTMLElement).dataset.group ?? activeGroup;
				}
			},
			{ root: gridWrap, threshold: 0, rootMargin: "0px 0px -80% 0px" },
		);
		for (const el of gridWrap.querySelectorAll<HTMLElement>("[data-group]")) emojiObserver.observe(el);
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
		if (file) readFile(file);
	}

	function readFile(file: File) {
		if (!file.type.startsWith("image/")) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedDataUrl = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	// ── Positioning ──
	onMount(async () => {
		await new Promise((r) => requestAnimationFrame(r));
		if (!popoverEl) return;
		const pop = popoverEl.getBoundingClientRect();
		const margin = 8;
		let top = anchorRect.top;
		let left = anchorRect.right + margin;

		if (left + pop.width > window.innerWidth - margin) left = anchorRect.left - pop.width - margin;
		if (top + pop.height > window.innerHeight - margin) top = window.innerHeight - pop.height - margin;
		top = Math.max(margin, top);

		style = `top:${top}px;left:${left}px;opacity:1`;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") onClose();
	}

	function onOutsideClick(e: MouseEvent) {
		if (popoverEl && !e.composedPath().includes(popoverEl)) onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} onmousedown={onOutsideClick} />

<div class="pop" {style} bind:this={popoverEl} role="dialog" aria-label="Icon picker">
	<!-- Tabs -->
	<div class="tabs">
		<button class="tab" class:active={activeTab === "emoji"} onclick={() => (activeTab = "emoji")}>
			<svg
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				width="13"
				height="13"
				><circle cx="8" cy="8" r="6" /><path d="M5.5 9.5s.8 1.5 2.5 1.5 2.5-1.5 2.5-1.5" /><circle
					cx="6"
					cy="6.5"
					r=".6"
					fill="currentColor"
					stroke="none"
				/><circle cx="10" cy="6.5" r=".6" fill="currentColor" stroke="none" /></svg
			>
			Emoji
		</button>
		<button class="tab" class:active={activeTab === "logo"} onclick={() => (activeTab = "logo")}>
			<svg
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				width="13"
				height="13"
				><rect x="2" y="2" width="12" height="12" rx="3" /><circle cx="5.5" cy="5.5" r="1" /><path
					d="M14 10l-3.5-3.5L6 11"
				/></svg
			>
			Logo
		</button>
		<button class="tab" class:active={activeTab === "upload"} onclick={() => (activeTab = "upload")}>
			<svg
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				width="13"
				height="13"
				><path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" /><polyline points="11 5 8 2 5 5" /><line
					x1="8"
					y1="2"
					x2="8"
					y2="11"
				/></svg
			>
			Upload
		</button>
		<button class="tab-close" onclick={onClose} aria-label="Close">
			<svg
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				width="12"
				height="12"><path d="M4 4l8 8M12 4l-8 8" /></svg
			>
		</button>
	</div>

	<!-- Emoji -->
	{#if activeTab === "emoji"}
		<div class="pane pane--emoji">
			<input class="inp" type="text" placeholder="Search emoji…" bind:value={emojiSearch} />
			{#if !emojiSearch.trim()}
				<div class="eg-tabs">
					{#each groups as g}
						<button
							class="eg-tab"
							class:active={activeGroup === g.name}
							title={g.name}
							onclick={() => scrollToGroup(g.name)}
						>
							{GROUP_ICONS[g.name] ?? "·"}
						</button>
					{/each}
				</div>
			{/if}
			<div class="eg-grid-wrap" bind:this={gridWrap}>
				{#if filteredEmoji}
					<div class="eg-grid">
						{#each filteredEmoji as e}
							<button
								class="eg-btn"
								title={e.name}
								onclick={() => onSelect({ type: "emoji", value: e.emoji })}>{e.emoji}</button
							>
						{/each}
					</div>
					{#if filteredEmoji.length === 0}<div class="hint" style="padding:12px;text-align:center">
							No results
						</div>{/if}
				{:else}
					{#each groups as g}
						<div data-group={g.name}>
							<div class="eg-label">{g.name}</div>
							<div class="eg-grid">
								{#each g.emojis as e}
									{#if !e.skin_tone_support || !e.name.includes("skin tone")}
										<button
											class="eg-btn"
											title={e.name}
											onclick={() => onSelect({ type: "emoji", value: e.emoji })}
											>{e.emoji}</button
										>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Logo -->
	{:else if activeTab === "logo"}
		<div class="pane pane--logo">
			<input
				class="inp"
				type="text"
				placeholder="bankofamerica.com"
				bind:value={domain}
				oninput={onDomainInput}
				onkeydown={(e) => e.key === "Enter" && fetchLogo()}
			/>
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
					if (f) readFile(f);
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
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						width="22"
						height="22"
						style="opacity:0.3;color:var(--color-pageText)"
						><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line
							x1="12"
							y1="3"
							x2="12"
							y2="15"
						/></svg
					>
					<span class="dropzone__label">Drop image or click to browse</span>
				{/if}
			</div>
			{#if uploadedDataUrl}
				<button class="btn-primary" onclick={() => onSelect({ type: "dataUrl", value: uploadedDataUrl! })}
					>Use this image</button
				>
			{/if}
		</div>
	{/if}

	<!-- Footer -->
	{#if hasIcon && onRemove}
		<div class="footer">
			<button class="btn-remove" onclick={onRemove}>Remove icon</button>
		</div>
	{/if}
</div>

<style>
	.pop {
		position: fixed;
		z-index: 10001;
		background: var(--color-menuBackground);
		border: 1px solid var(--color-menuBorder);
		border-radius: var(--border-radius);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
		width: 280px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: opacity 0.15s;
	}

	.tabs {
		display: flex;
		align-items: center;
		padding: 0 4px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-pageText) 8%, transparent);
		flex-shrink: 0;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 9px 8px;
		border: none;
		background: transparent;
		color: var(--color-pageTextSubdued);
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition:
			color 0.1s,
			border-color 0.1s;
	}

	.tab:hover {
		color: var(--color-pageText);
	}
	.tab.active {
		color: var(--color-sidebarItemAccentSelected);
		border-bottom-color: var(--color-sidebarItemAccentSelected);
	}

	.tab-close {
		margin-left: auto;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.tab-close:hover {
		background: color-mix(in srgb, var(--color-pageText) 8%, transparent);
		color: var(--color-pageText);
	}

	.pane {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
	}
	.pane--emoji {
		padding: 8px;
	}

	/* ── Emoji ── */
	.eg-tabs {
		display: flex;
		gap: 1px;
		padding-bottom: 4px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-pageText) 8%, transparent);
	}

	.eg-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3px 0;
		border: none;
		border-radius: 4px;
		background: none;
		font-size: 13px;
		cursor: pointer;
		opacity: 0.45;
		transition:
			opacity 0.08s,
			background 0.08s;
	}

	.eg-tab:hover {
		opacity: 0.8;
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
	}
	.eg-tab.active {
		opacity: 1;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent);
	}

	.eg-grid-wrap {
		max-height: 220px;
		overflow-y: auto;
		scrollbar-width: thin;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.eg-label {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-pageTextSubdued);
		padding: 4px 2px 2px;
		position: sticky;
		top: 0;
		background: var(--color-menuBackground);
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
		border-radius: 4px;
		background: none;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		transition: background 0.08s;
	}

	.eg-btn:hover {
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}

	/* ── Logo ── */
	.logo-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 12px;
		border-radius: 8px;
		border: 1px solid var(--color-tableBorder);
		background: color-mix(in srgb, var(--color-pageText) 3%, transparent);
		cursor: default;
		min-height: 80px;
		transition:
			background 0.15s,
			border-color 0.15s;
		width: 100%;
	}

	.logo-preview.loaded {
		cursor: pointer;
		border-color: var(--color-sidebarItemAccentSelected);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 6%, transparent);
	}
	.logo-preview.loaded:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, transparent);
	}
	.logo-preview img {
		width: 48px;
		height: 48px;
		object-fit: contain;
		border-radius: 6px;
	}
	.logo-preview__hint {
		font-size: 10px;
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 500;
	}
	.logo-preview__err {
		font-size: 11px;
		color: var(--color-errorText);
	}

	/* ── Upload ── */
	.dropzone {
		border: 2px dashed var(--color-tableBorder);
		border-radius: 8px;
		min-height: 100px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
		padding: 12px;
	}

	.dropzone:hover,
	.dropzone.over {
		border-color: var(--color-sidebarItemAccentSelected);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 5%, transparent);
	}
	.dropzone__label {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		text-align: center;
	}
	.dropzone__img {
		max-width: 100%;
		max-height: 80px;
		object-fit: contain;
		border-radius: 6px;
	}
	.dropzone__hint {
		font-size: 10px;
		color: var(--color-pageTextSubdued);
	}

	/* ── Footer ── */
	.footer {
		padding: 6px 10px 8px;
		border-top: 1px solid color-mix(in srgb, var(--color-pageText) 8%, transparent);
	}

	/* ── Shared ── */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.inp {
		width: 100%;
		padding: 7px 9px;
		font-size: 12px;
		font-family: inherit;
		border: 1px solid var(--color-tableBorder);
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
		color: var(--color-pageText);
		outline: none;
		box-sizing: border-box;
	}

	.inp:focus {
		border-color: var(--color-sidebarItemAccentSelected);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, transparent);
	}
	.inp::placeholder {
		color: var(--color-pageTextSubdued);
		opacity: 0.5;
	}

	.hint {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		margin: 0;
		padding: 4px 0;
	}

	.btn-primary {
		width: 100%;
		padding: 7px;
		border: none;
		border-radius: 6px;
		background: var(--color-buttonPrimaryBackground);
		color: var(--color-buttonPrimaryText);
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.1s;
	}

	.btn-primary:hover {
		background: var(--color-buttonPrimaryBackgroundHover);
	}

	.btn-remove {
		width: 100%;
		padding: 5px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-errorText);
		font-size: 11px;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.1s;
	}

	.btn-remove:hover {
		background: color-mix(in srgb, var(--color-errorText) 8%, transparent);
	}
</style>
