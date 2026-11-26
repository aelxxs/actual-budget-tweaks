<script lang="ts">
	import CategoryIcon from "@lib/components/CategoryIcon.svelte";
	import SearchField from "@lib/components/SearchField.svelte";
	import type { Searchable } from "./data";

	let {
		candidates,
		query = $bindable(""),
		onPick,
	}: { candidates: Searchable[]; query?: string; onPick: (c: Searchable) => void } = $props();

	const SHOWN = 8;
	const KIND_LABEL = { account: "Account", category: "Category", payee: "Payee" };

	let active = $state(0);
	let searching = $state(false);

	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			return [];
		}
		return candidates
			.filter((c) => c.name.toLowerCase().includes(q))
			.sort(
				(a, b) =>
					Number(!a.name.toLowerCase().startsWith(q)) -
						Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name),
			)
			.slice(0, SHOWN);
	});

	function pick(c: Searchable) {
		query = "";
		onPick(c);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === "Escape") {
			query = "";
			(e.currentTarget as HTMLInputElement).blur();
		} else if (e.key === "ArrowDown" && results.length) {
			e.preventDefault();
			active = (active + 1) % results.length;
		} else if (e.key === "ArrowUp" && results.length) {
			e.preventDefault();
			active = (active - 1 + results.length) % results.length;
		} else if (e.key === "Enter" && results[active]) {
			pick(results[active]);
		}
	}
</script>

<div class="search">
	<SearchField
		label="Find an account, category or payee"
		placeholder="Find a node"
		bind:value={query}
		oninput={() => (active = 0)}
		onkeydown={onKey}
		onfocus={() => (searching = true)}
		onblur={() => (searching = false)}
	/>
	{#if searching && results.length}
		<!-- Keeps focus in the field, so a click on a result lands before the list closes. -->
		<div
			class="search__results abt-popover abt-menu"
			role="listbox"
			tabindex="-1"
			onpointerdown={(e) => e.preventDefault()}
		>
			{#each results as c, i (c.id)}
				<button
					type="button"
					class="abt-menu__item"
					class:is-active={i === active}
					role="option"
					aria-selected={i === active}
					onpointerenter={() => (active = i)}
					onclick={() => pick(c)}
				>
					{#if c.kind === "category"}<CategoryIcon id={c.id.slice("category:".length)} />{/if}
					<span class="search__name">{c.name}</span>
					<span class="search__kind">{KIND_LABEL[c.kind]}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.search {
		position: relative;
		display: flex;
		width: 220px;
	}

	/* Narrows with the header's short labels in GraphView. */
	@container (max-width: 1080px) {
		.search {
			width: 160px;
		}
	}

	.search__results {
		position: absolute;
		top: calc(100% + var(--abt-space-2));
		left: 0;
		z-index: 2;
		width: 260px;
	}

	.search__results .abt-menu__item {
		align-items: center;
	}

	.search__results .is-active {
		background: var(--abt-fill);
	}

	.search__name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search__kind {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
</style>
