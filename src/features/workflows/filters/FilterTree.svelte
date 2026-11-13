<script lang="ts" module>
	export interface TreeItem {
		id: string;
		name: string;
	}

	export interface TreeSection<T extends TreeItem = TreeItem> {
		id: string;
		label: string;
		items: T[];
		groups: { id: string; label: string; items: T[] }[];
	}
</script>

<script lang="ts" generics="T extends TreeItem">
	import Tick from "@lib/components/Tick.svelte";
	import { Search } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	const {
		sections,
		hidden,
		onHidden,
		noun,
		icon,
	}: {
		sections: TreeSection<T>[];
		/** Hidden ids, which may include items this tree doesn't list. */
		hidden: string[];
		onHidden: (ids: string[]) => void;
		/** Plural, for the search placeholder and empty state. */
		noun: string;
		icon?: Snippet<[T]>;
	} = $props();

	let search = $state("");

	const hiddenSet = $derived(new Set(hidden));
	const listed = $derived(
		sections.flatMap((s) => [...s.items, ...s.groups.flatMap((g) => g.items)]),
	);
	const filtering = $derived(listed.some((i) => hiddenSet.has(i.id)));

	const visible = $derived.by(() => {
		const term = search.trim().toLowerCase();
		const has = (text: string) => text.toLowerCase().includes(term);
		return sections
			.map((s) => {
				const sectionHit = !term || has(s.label);
				const items = s.items.filter((i) => sectionHit || has(i.name));
				const groups = s.groups
					.map((g) => ({
						...g,
						items: g.items.filter((i) => sectionHit || has(g.label) || has(i.name)),
					}))
					.filter((g) => g.items.length);
				return { ...s, items, groups, all: [...items, ...groups.flatMap((g) => g.items)] };
			})
			.filter((s) => s.all.length);
	});

	function setShown(ids: string[], shown: boolean) {
		const next = new Set(hidden);
		for (const id of ids) {
			if (shown) {
				next.delete(id);
			} else {
				next.add(id);
			}
		}
		onHidden([...next]);
	}

	function only(id: string) {
		const ids = new Set(listed.map((i) => i.id));
		onHidden([...hidden.filter((h) => !ids.has(h)), ...[...ids].filter((i) => i !== id)]);
	}

	function showAll() {
		const ids = new Set(listed.map((i) => i.id));
		onHidden(hidden.filter((h) => !ids.has(h)));
	}

	function groupState(items: T[]) {
		const shown = items.filter((i) => !hiddenSet.has(i.id)).length;
		return { shown, checked: shown === items.length, mixed: shown > 0 && shown < items.length };
	}

	function focusSearch(node: HTMLInputElement) {
		requestAnimationFrame(() => node.focus());
	}
</script>

{#snippet header(label: string, items: T[], depth: number)}
	{@const state = groupState(items)}
	<label class="ft__head" class:is-sub={depth > 0} style:--depth={depth}>
		<Tick
			checked={state.checked}
			mixed={state.mixed}
			onCheckedChange={(checked) =>
				setShown(
					items.map((i) => i.id),
					checked,
				)}
		/>
		<span class="ft__label">{label}</span>
		<span class="ft__count">{state.shown}/{items.length}</span>
	</label>
{/snippet}

{#snippet row(item: T, depth: number)}
	<div class="ft__row" style:--depth={depth} class:is-off={hiddenSet.has(item.id)}>
		<label class="ft__row-main">
			<Tick
				checked={!hiddenSet.has(item.id)}
				onCheckedChange={(checked) => setShown([item.id], checked)}
			/>
			{#if icon}
				<span class="ft__icon">{@render icon(item)}</span>
			{/if}
			<span class="ft__label">{item.name}</span>
		</label>
		<button
			type="button"
			class="ft__only"
			title="Show only {item.name}"
			onclick={() => only(item.id)}>Only</button
		>
	</div>
{/snippet}

<div class="ft__bar">
	<span class="ft__search">
		<Search size={14} strokeWidth={1.75} />
		<input
			class="abt-input"
			type="search"
			placeholder="Search {noun}"
			aria-label="Search {noun}"
			bind:value={search}
			use:focusSearch
		/>
	</span>
	<button
		type="button"
		class="abt-btn abt-btn--sm abt-btn--ghost"
		disabled={!filtering}
		onclick={showAll}>Show all</button
	>
</div>
<div class="ft__list">
	{#each visible as section (section.id)}
		<div class="ft__section">
			{@render header(section.label, section.all, 0)}
			{#each section.items as item (item.id)}
				{@render row(item, 1)}
			{/each}
			{#each section.groups as group (group.id)}
				{@render header(group.label, group.items, 1)}
				{#each group.items as item (item.id)}
					{@render row(item, 2)}
				{/each}
			{/each}
		</div>
	{:else}
		<div class="ft__empty">
			{search.trim() ? `No ${noun} match “${search.trim()}”` : `No ${noun}`}
		</div>
	{/each}
</div>

<style>
	.ft__bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding: var(--abt-space-1) var(--abt-space-1) var(--abt-space-2);
	}

	.ft__search {
		position: relative;
		display: flex;
		flex: 1;
		align-items: center;
		min-width: 0;
		color: var(--color-pageTextSubdued);
	}

	.ft__search :global(svg) {
		position: absolute;
		left: var(--abt-space-3);
		pointer-events: none;
	}

	.ft__search input {
		flex: 1;
		padding-left: calc(var(--abt-space-3) + 20px);
	}

	.ft__list {
		min-height: 0;
		overflow-y: auto;
	}

	.ft__section + .ft__section {
		margin-top: var(--abt-space-2);
	}

	.ft__head,
	.ft__row-main {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--abt-space-3);
		min-width: 0;
		padding: var(--abt-space-2) var(--abt-space-3);
		/* One step per level: section, then its items and groups, then each group's items. */
		padding-left: calc(var(--abt-space-3) + var(--depth, 0) * 14px);
		border-radius: var(--abt-radius-sm);
		cursor: pointer;
	}

	.ft__head {
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
	}

	.ft__head.is-sub {
		letter-spacing: 0;
		text-transform: none;
	}

	.ft__head:hover,
	.ft__row:hover {
		background: var(--abt-fill-hover);
	}

	.ft__label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ft__count {
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0;
	}

	.ft__row {
		display: flex;
		align-items: center;
		border-radius: var(--abt-radius-sm);
		font-size: var(--abt-text-md);
	}

	.ft__row.is-off .ft__icon,
	.ft__row.is-off .ft__label {
		opacity: 0.5;
	}

	.ft__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		color: var(--color-pageTextSubdued);
	}

	.ft__only {
		flex-shrink: 0;
		margin-right: var(--abt-space-2);
		padding: var(--abt-space-1) var(--abt-space-2);
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageTextSubdued);
		font: inherit;
		font-size: var(--abt-text-sm);
		cursor: pointer;
		visibility: hidden;
	}

	.ft__row:hover .ft__only,
	.ft__only:focus-visible {
		visibility: visible;
	}

	.ft__only:hover {
		background: var(--abt-fill);
		color: var(--color-pageText);
	}

	.ft__empty {
		padding: var(--abt-space-4) var(--abt-space-3);
		font-size: var(--abt-text-md);
		color: var(--color-pageTextSubdued);
		text-align: center;
	}
</style>
