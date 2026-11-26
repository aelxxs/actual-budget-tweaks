<script lang="ts" module>
	export interface PickerItem {
		id: string;
		name: string;
	}
	export interface PickerSection {
		id: string;
		/** Shown above its items; a list with one unnamed section has no headings. */
		name?: string;
		items: PickerItem[];
	}
</script>

<script lang="ts">
	import { onOutsideClick, positionPopover } from "@lib/dom/popover";
	import { portal } from "@lib/dom/svelte";
	import { Check, ChevronDown } from "@lucide/svelte";
	import SearchField from "./SearchField.svelte";
	import { tick, type Snippet } from "svelte";

	/** A dropdown with search, for lists too long for a native select. */
	const {
		sections,
		value,
		label,
		placeholder = "Choose",
		searchLabel = "Search",
		noun = "items",
		disabled = false,
		attention = false,
		clearLabel,
		icon,
		onPick,
	}: {
		sections: PickerSection[];
		value: string | null;
		/** What the choice is for, read out by screen readers. */
		label: string;
		placeholder?: string;
		searchLabel?: string;
		/** What the list holds, for "No {noun} match". */
		noun?: string;
		disabled?: boolean;
		/** Marks the trigger, e.g. while something still needs choosing. */
		attention?: boolean;
		/** Offers clearing the choice, under this name, ahead of the list. */
		clearLabel?: string;
		/** Drawn before a name, in the trigger and in the list. */
		icon?: Snippet<[string | null]>;
		onPick: (id: string | null) => void;
	} = $props();

	let open = $state(false);
	let query = $state("");
	let active = $state(0);
	let trigger = $state<HTMLButtonElement | null>(null);
	let menu = $state<HTMLDivElement | null>(null);
	let search = $state<HTMLInputElement | null>(null);
	let list = $state<HTMLDivElement | null>(null);
	const listId = `abt-picker-${Math.random().toString(36).slice(2, 8)}`;

	const names = $derived(
		new Map(sections.flatMap((s) => s.items.map((i) => [i.id, i.name] as const))),
	);
	const current = $derived(value ? (names.get(value) ?? value) : placeholder);

	// Searching matches an item's name or its section's, so "food" finds everything under Food.
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return sections
			.map((s) => ({
				...s,
				items:
					!q || s.name?.toLowerCase().includes(q)
						? s.items
						: s.items.filter((i) => i.name.toLowerCase().includes(q)),
			}))
			.filter((s) => s.items.length > 0);
	});
	// The clear choice's id; null is what it picks.
	const CLEAR = "";
	const clearShown = $derived(
		!!clearLabel && clearLabel.toLowerCase().includes(query.trim().toLowerCase()),
	);
	const flat = $derived([
		...(clearShown ? [{ id: CLEAR, name: clearLabel ?? "" }] : []),
		...shown.flatMap((s) => s.items),
	]);

	async function show() {
		query = "";
		open = true;
		await tick();
		const at = flat.findIndex((i) => i.id === (value ?? CLEAR));
		active = Math.max(0, at);
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
		const next = id === CLEAR ? null : id;
		if (next !== value) {
			onPick(next);
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
	aria-label="{label}: {current}"
	bind:this={trigger}
	onclick={() => (open ? close() : show())}
>
	{@render icon?.(value)}
	<span class="current">{current}</span>
	<ChevronDown size={14} />
</button>

{#if open}
	<div class="menu abt-popover" use:portal bind:this={menu}>
		<span class="search">
			<SearchField
				label={searchLabel}
				aria-controls={listId}
				bind:value={query}
				bind:input={search}
				onkeydown={onKey}
			/>
		</span>
		<div class="list" id={listId} role="listbox" aria-label={label} bind:this={list}>
			{#if clearShown}
				<button
					type="button"
					role="option"
					class="option clear"
					class:active={active === 0}
					aria-selected={!value}
					data-index={0}
					tabindex="-1"
					onpointermove={() => (active = 0)}
					onclick={() => pick(CLEAR)}
				>
					<span class="name">{clearLabel}</span>
					{#if !value}<Check size={14} class="check" />{/if}
				</button>
			{/if}
			{#each shown as section (section.id)}
				{#if section.name}
					<div class="group" role="presentation">{section.name}</div>
				{/if}
				{#each section.items as item (item.id)}
					{@const index = flat.indexOf(item)}
					<button
						type="button"
						role="option"
						class="option"
						class:active={index === active}
						aria-selected={item.id === value}
						data-index={index}
						tabindex="-1"
						onpointermove={() => (active = index)}
						onclick={() => pick(item.id)}
					>
						{@render icon?.(item.id)}
						<span class="name">{item.name}</span>
						{#if item.id === value}<Check size={14} class="check" />{/if}
					</button>
				{/each}
			{:else}
				{#if !clearShown}
					<p class="none">No {noun} match "{query}".</p>
				{/if}
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
		display: flex;
		flex: none;
		margin-bottom: var(--abt-space-2);
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
	.option.clear {
		color: var(--abt-muted);
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
