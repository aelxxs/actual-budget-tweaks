<script lang="ts">
	import { hasCategoryIcons, useCategoryIcons } from "@lib/category-icons.svelte";
	import CategoryIcon from "@lib/components/CategoryIcon.svelte";
	import { getEmojiAssetUrl } from "@lib/account-icons";
	import Tabs from "@lib/components/Tabs.svelte";
	import type { Category, CategoryGroup } from "@lib/types/actual-schema";
	import { onOutsideClick, positionPopover } from "@lib/dom/popover";
	import { Wallet } from "@lucide/svelte";
	import { onMount, type Snippet } from "svelte";
	import FilterTree from "./FilterTree.svelte";
	import {
		accountSections,
		categorySections,
		loadAccountLayout,
		type AccountLayout,
		type FilterAccount,
	} from "./filter-trees";
	import type { BaseFilters, Flow } from "./types";

	let {
		open = $bindable(false),
		filters,
		accounts,
		categories,
		categoryGroups,
		onChange,
		onClear,
		extraActive = false,
		toggles,
	}: {
		open?: boolean;
		filters: BaseFilters;
		accounts: FilterAccount[];
		categories: Pick<Category, "id" | "name" | "group">[];
		categoryGroups: Pick<CategoryGroup, "id" | "name">[];
		onChange: (patch: Partial<BaseFilters>) => void;
		/** "Clear all"; each page decides what its view preferences keep. */
		onClear: () => void;
		/** Whether a page's own switch is filtering something out. */
		extraActive?: boolean;
		/** The page's own switches, under the flow; FilterToggle draws one. */
		toggles?: Snippet;
	} = $props();

	const FLOWS: { value: Flow; label: string }[] = [
		{ value: "all", label: "All" },
		{ value: "spending", label: "Spending" },
		{ value: "income", label: "Income" },
	];

	let button = $state<HTMLElement | null>(null);
	let menu = $state<HTMLElement | null>(null);
	let tab = $state<"accounts" | "categories">("accounts");
	let layout = $state<AccountLayout>({ icons: {}, groups: {}, assignments: {}, order: [] });

	onMount(async () => {
		layout = await loadAccountLayout();
	});

	const accountTree = $derived(accountSections(accounts, layout, filters.hideOffBudget));
	const categoryTree = $derived(categorySections(categoryGroups, categories));
	const filtering = $derived(
		extraActive ||
			filters.flow !== "all" ||
			filters.hiddenCategories.length > 0 ||
			accountTree.some((s) =>
				[...s.items, ...s.groups.flatMap((g) => g.items)].some((a) =>
					filters.hiddenAccounts.includes(a.id),
				),
			),
	);

	$effect(() => {
		if (!open || !menu || !button) {
			return;
		}
		positionPopover(menu, button, { align: "right" });
		return onOutsideClick([menu, button], () => (open = false));
	});
	$effect(() => useCategoryIcons());
</script>

{#snippet categoryIcon(category: { id: string })}
	<CategoryIcon id={category.id} />
{/snippet}

{#snippet accountIcon(account: FilterAccount)}
	{@const icon = layout.icons[account.id]}
	{#if icon}
		<img
			class="fp__img"
			src={icon.type === "emoji" ? getEmojiAssetUrl(icon.value) : icon.value}
			alt=""
		/>
	{:else}
		<Wallet size={14} strokeWidth={1.75} />
	{/if}
{/snippet}

<button
	type="button"
	class="fp-btn abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
	class:is-active={open}
	class:is-filtering={filtering}
	title={filtering ? "Filters (some transactions hidden)" : "Filters"}
	aria-label="Filters"
	aria-expanded={open}
	bind:this={button}
	onclick={() => (open = !open)}
>
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg
	>
</button>

{#if open}
	<div class="fp abt-popover" bind:this={menu}>
		<div class="fp__top">
			<span class="fp__title">Filters</span>
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-btn--ghost"
				disabled={!filtering}
				onclick={onClear}>Clear all</button
			>
		</div>
		<div class="abt-seg fp__flow" role="group" aria-label="Show">
			{#each FLOWS as f (f.value)}
				<button
					type="button"
					aria-pressed={filters.flow === f.value}
					onclick={() => onChange({ flow: f.value })}>{f.label}</button
				>
			{/each}
		</div>
		{@render toggles?.()}
		<div class="fp__tabs">
			<Tabs
				tabs={[
					{ value: "accounts", label: "Accounts" },
					{ value: "categories", label: "Categories" },
				]}
				bind:value={tab}
				--abt-tabs-bg="none"
				--abt-tabs-pad="var(--abt-space-3)"
			/>
		</div>
		{#key tab}
			{#if tab === "accounts"}
				<FilterTree
					sections={accountTree}
					hidden={filters.hiddenAccounts}
					onHidden={(hiddenAccounts) => onChange({ hiddenAccounts })}
					noun="accounts"
					icon={accountIcon}
				/>
			{:else}
				<FilterTree
					sections={categoryTree}
					hidden={filters.hiddenCategories}
					onHidden={(hiddenCategories) => onChange({ hiddenCategories })}
					noun="categories"
					icon={hasCategoryIcons() ? categoryIcon : undefined}
				/>
			{/if}
		{/key}
	</div>
{/if}

<style>
	.fp-btn {
		position: relative;
	}

	.fp-btn.is-active {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
	}

	/* Marks the button while anything is filtered out, so a thinner view isn't a mystery. */
	.fp-btn.is-filtering::after {
		content: "";
		position: absolute;
		top: 3px;
		right: 3px;
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent);
	}

	.fp {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		width: 340px;
		max-height: min(560px, 75vh);
		padding: var(--abt-space-2);
	}

	.fp__top {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--abt-space-1) var(--abt-space-2) var(--abt-space-3);
	}

	.fp__title {
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--abt-muted);
	}

	.fp__flow {
		flex-shrink: 0;
		--abt-btn-h: 26px; /* raw: between the small and default controls */
		display: flex;
		margin: var(--abt-space-1) var(--abt-space-1) var(--abt-space-2);
	}

	.fp__flow > button {
		flex: 1;
		justify-content: center;
	}

	.fp__tabs {
		flex-shrink: 0;
		margin: var(--abt-space-2) 0 var(--abt-space-3);
	}

	.fp__img {
		width: 16px;
		height: 16px;
		object-fit: cover;
		border-radius: 2px;
	}
</style>
