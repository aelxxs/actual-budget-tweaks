<script lang="ts">
	import emojiData from "unicode-emoji-json/data-by-group.json";

	const { onSelect, onRemove, onClose, hasEmoji } = $props<{
		onSelect: (emoji: string) => void;
		onRemove: () => void;
		onClose: () => void;
		hasEmoji: boolean;
	}>();

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
		"Activities": "⚽",
		"Objects": "💡",
		"Symbols": "💱",
		"Flags": "🏳️",
	};

	let search = $state("");
	let activeGroup = $state(groups[0]?.name ?? "");
	let gridWrap: HTMLElement | undefined = $state();

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return null;
		const results: EmojiEntry[] = [];
		for (const g of groups) {
			for (const e of g.emojis) {
				if (e.name.includes(q) || e.slug.includes(q)) {
					results.push(e);
				}
				if (results.length >= 80) return results;
			}
		}
		return results;
	});

	function scrollToGroup(name: string) {
		activeGroup = name;
		search = "";
		const el = gridWrap?.querySelector(`[data-group="${name}"]`);
		el?.scrollIntoView({ block: "start", behavior: "smooth" });
	}
</script>

<div class="ep">
	<input
		class="ep__search"
		type="text"
		placeholder="Search emoji…"
		bind:value={search}
	/>

	{#if !search.trim()}
		<div class="ep__tabs">
			{#each groups as group}
				<button
					class="ep__tab"
					class:is-active={activeGroup === group.name}
					title={group.name}
					onclick={() => scrollToGroup(group.name)}
				>
					{GROUP_ICONS[group.name] ?? "·"}
				</button>
			{/each}
		</div>
	{/if}

	<div class="ep__grid-wrap" bind:this={gridWrap}>
		{#if filtered}
			<div class="ep__grid">
				{#each filtered as entry}
					<button class="ep__emoji" onclick={() => onSelect(entry.emoji)} title={entry.name}>
						{entry.emoji}
					</button>
				{/each}
			</div>
			{#if filtered.length === 0}
				<div class="ep__empty">No emoji found</div>
			{/if}
		{:else}
			{#each groups as group}
				<div data-group={group.name}>
					<div class="ep__group-label">{group.name}</div>
					<div class="ep__grid">
						{#each group.emojis as entry}
							{#if !entry.skin_tone_support || !entry.name.includes("skin tone")}
								<button class="ep__emoji" onclick={() => onSelect(entry.emoji)} title={entry.name}>
									{entry.emoji}
								</button>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	{#if hasEmoji}
		<button class="ep__remove" onclick={onRemove}>Remove emoji</button>
	{/if}
</div>

<style>
	.ep {
		width: 320px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
	}

	.ep__search {
		width: 100%;
		padding: 6px 8px;
		font-size: 12px;
		font-family: inherit;
		border: 1px solid var(--color-tableBorder);
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
		color: var(--color-pageText);
		outline: none;
		box-sizing: border-box;
	}

	.ep__search:focus {
		border-color: var(--color-sidebarItemAccentSelected);
	}

	.ep__search::placeholder {
		color: var(--color-pageTextSubdued);
		opacity: 0.5;
	}

	.ep__tabs {
		display: flex;
		gap: 1px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-pageText) 8%, transparent);
		padding-bottom: 4px;
	}

	.ep__tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 0;
		border: none;
		border-radius: 4px;
		background: none;
		font-size: 14px;
		cursor: pointer;
		opacity: 0.5;
		transition: opacity 0.08s, background 0.08s;
	}

	.ep__tab:hover {
		opacity: 0.8;
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
	}

	.ep__tab.is-active {
		opacity: 1;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent);
	}

	.ep__grid-wrap {
		max-height: 260px;
		overflow-y: auto;
		scrollbar-width: thin;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.ep__group-label {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-pageTextSubdued);
		padding: 4px 2px 2px;
		position: sticky;
		top: 0;
		background: var(--color-menuBackground);
		z-index: 1;
	}

	.ep__grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 2px;
	}

	.ep__emoji {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		aspect-ratio: 1;
		border: none;
		border-radius: 4px;
		background: none;
		font-size: 20px;
		cursor: pointer;
		transition: background 0.08s;
		padding: 0;
		line-height: 1;
	}

	.ep__emoji:hover {
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}

	.ep__empty {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		text-align: center;
		padding: 16px;
	}

	.ep__remove {
		width: 100%;
		padding: 6px;
		margin-top: 2px;
		font-size: 11px;
		font-family: inherit;
		border: none;
		border-radius: 6px;
		border-top: 1px solid color-mix(in srgb, var(--color-pageText) 8%, transparent);
		background: none;
		color: var(--color-errorText);
		cursor: pointer;
		transition: background 0.08s;
	}

	.ep__remove:hover {
		background: color-mix(in srgb, var(--color-errorText) 10%, transparent);
	}
</style>
