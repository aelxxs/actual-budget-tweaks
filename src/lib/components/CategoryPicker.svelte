<script lang="ts" module>
	export interface PickerGroup {
		id: string;
		name: string;
		categories: { id: string; name: string }[];
	}
</script>

<script lang="ts">
	import CategoryIcon from "./CategoryIcon.svelte";
	import { onOutsideClick, positionPopover } from "@lib/dom/popover";
	import { portal } from "@lib/dom/svelte";
	import { Check, ChevronDown, Search } from "@lucide/svelte";
	import { tick } from "svelte";

	/** A category chooser with search, grouped as the budget shows them. */
	const {
		groups,
		value,
		label,
		placeholder = "Choose a category",
		disabled = false,
		attention = false,
		onPick,
	}: {
		groups: PickerGroup[];
		value: string | null;
		/** What the choice is for, read out by screen readers. */
		label: string;
		placeholder?: string;
		disabled?: boolean;
		/** Marks the trigger, e.g. while the transaction still needs a category. */
		attention?: boolean;
		onPick: (id: string) => void;
	} = $props();

	let open = $state(false);
	let query = $state("");
	let active = $state(0);
	let trigger = $state<HTMLButtonElement | null>(null);
	let menu = $state<HTMLDivElement | null>(null);
	let search = $state<HTMLInputElement | null>(null);
	let list = $state<HTMLDivElement | null>(null);

	const names = $derived(
		new Map(groups.flatMap((g) => g.categories.map((c) => [c.id, c.name] as const))),
	);

	// Searching matches a category's name or its group's, so "food" finds everything under Food.
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return groups
			.map((g) => ({
				...g,
				categories:
					!q || g.name.toLowerCase().includes(q)
						? g.categories
						: g.categories.filter((c) => c.name.toLowerCase().includes(q)),
			}))
			.filter((g) => g.categories.length > 0);
	});
	const flat = $derived(shown.flatMap((g) => g.categories));

	async function show() {
		query = "";
		open = true;
		await tick();
		const current = flat.findIndex((c) => c.id === value);
		active = Math.max(0, current);
		search?.focus();
		scrollToActive();
	}

	function close(refocus = true) {
		open = false;
		if (refocus) {
			trigger?.focus();
		}
	}

	function pick(id: string) {
		close();
		if (id !== value) {
			onPick(id);
		}
	}

	function scrollToActive() {
		list
			?.querySelector<HTMLElement>(`[data-index="${active}"]`)
			?.scrollIntoView({ block: "nearest" });
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const step = e.key === "ArrowDown" ? 1 : -1;
			active = (active + step + flat.length) % Math.max(flat.length, 1);
			scrollToActive();
		} else if (e.key === "Enter") {
			e.preventDefault();
			const choice = flat[active];
			if (choice) {
				pick(choice.id);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			close();
		} else if (e.key === "Tab") {
			close(false);
		}
	}

	$effect(() => {
		void query;
		active = 0;
	});

	$effect(() => {
		if (!open || !menu || !trigger) {
			return;
		}
		positionPopover(menu, trigger, { gap: 4 });
		return onOutsideClick([menu, trigger], () => close(false));
	});
</script>

<button
	type="button"
	class="trigger abt-input"
	class:attention
	class:empty={!value}
	{disabled}
	aria-haspopup="listbox"
	aria-expanded={open}
	aria-label="{label}: {value ? (names.get(value) ?? placeholder) : placeholder}"
	bind:this={trigger}
	onclick={() => (open ? close() : show())}
>
	<CategoryIcon id={value} />
	<span class="current">{value ? (names.get(value) ?? placeholder) : placeholder}</span>
	<ChevronDown size={14} />
</button>

{#if open}
	<div class="menu abt-popover" use:portal bind:this={menu}>
		<span class="search">
			<Search size={14} strokeWidth={1.75} />
			<input
				class="abt-input"
				type="search"
				placeholder="Search categories"
				aria-label="Search categories"
				aria-controls="abt-category-list"
				bind:value={query}
				bind:this={search}
				onkeydown={onKey}
			/>
		</span>
		<div class="list" id="abt-category-list" role="listbox" aria-label={label} bind:this={list}>
			{#each shown as group (group.id)}
				<div class="group" role="presentation">{group.name}</div>
				{#each group.categories as cat (cat.id)}
					{@const index = flat.indexOf(cat)}
					<button
						type="button"
						role="option"
						class="option"
						class:active={index === active}
						aria-selected={cat.id === value}
						data-index={index}
						tabindex="-1"
						onpointermove={() => (active = index)}
						onclick={() => pick(cat.id)}
					>
						<CategoryIcon id={cat.id} />
						<span class="name">{cat.name}</span>
						{#if cat.id === value}<Check size={14} class="check" />{/if}
					</button>
				{/each}
			{:else}
				<p class="none">No categories match "{query}".</p>
			{/each}
		</div>
	</div>
{/if}

<style>
	.trigger {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		width: 100%;
		min-width: 0;
		text-align: left;
		cursor: pointer;
	}
	.trigger:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.trigger.empty .current {
		color: var(--abt-subtle);
	}
	.trigger.attention {
		border-color: var(--abt-warning-4);
	}
	.current {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.menu {
		position: fixed;
		z-index: 10000;
		display: flex;
		flex-direction: column;
		width: 280px;
		max-height: min(360px, 60vh);
		padding: var(--abt-space-2);
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		flex: none;
		margin-bottom: var(--abt-space-2);
		color: var(--abt-subtle);
	}
	.search :global(svg) {
		position: absolute;
		left: var(--abt-space-3);
		pointer-events: none;
	}
	.search input {
		width: 100%;
		padding-left: calc(var(--abt-space-3) + 20px);
	}
	.list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.group {
		padding: var(--abt-space-3) var(--abt-space-3) var(--abt-space-1);
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-muted);
	}
	.group:first-child {
		padding-top: var(--abt-space-1);
	}
	.option {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		width: 100%;
		padding: var(--abt-space-2) var(--abt-space-3);
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		font-size: var(--abt-text-md);
		text-align: left;
		cursor: pointer;
	}
	.option.active {
		background: var(--abt-fill);
	}
	.option[aria-selected="true"] {
		color: var(--abt-accent-text);
		font-weight: 500;
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.option :global(.check) {
		flex: none;
		color: var(--abt-accent);
	}
	.none {
		margin: 0;
		padding: var(--abt-space-3);
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
</style>
