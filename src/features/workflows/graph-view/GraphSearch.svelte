<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
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
	<span class="search__icon" aria-hidden="true"><Icon name="search" size={14} /></span>
	<input
		class="abt-input"
		type="search"
		placeholder="Find a node"
		aria-label="Find an account, category or payee"
		bind:value={query}
		oninput={() => (active = 0)}
		onkeydown={onKey}
		onfocus={() => (searching = true)}
		onblur={() => (searching = false)}
	/>
	{#if query}
		<button
			type="button"
			class="search__clear"
			aria-label="Clear search"
			onpointerdown={(e) => e.preventDefault()}
			onclick={() => (query = "")}
		>
			<Icon name="close" size={12} />
		</button>
	{/if}
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
	}

	.search__icon {
		position: absolute;
		top: 50%;
		left: var(--abt-space-3);
		display: inline-flex;
		color: var(--abt-muted);
		transform: translateY(-50%);
		pointer-events: none;
	}

	.search .abt-input {
		width: 220px;
		padding-left: calc(var(--abt-space-3) + 20px);
		padding-right: 28px; /* raw: room for the clear button */
	}

	/* Narrows with the header's short labels in GraphView. */
	@container (max-width: 1080px) {
		.search .abt-input {
			width: 160px;
		}
	}

	/* Chrome's own clear button is blue on every theme; this one follows the field's ink. */
	.search .abt-input::-webkit-search-cancel-button {
		appearance: none;
	}

	.search__clear {
		position: absolute;
		top: 50%;
		right: var(--abt-space-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-muted);
		transform: translateY(-50%);
		cursor: pointer;
	}

	.search__clear:hover {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
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
