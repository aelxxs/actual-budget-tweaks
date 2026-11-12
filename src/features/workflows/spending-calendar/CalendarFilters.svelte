<script lang="ts">
	import { getEmojiAssetUrl } from "@features/appearance/account-icon-picker";
	import Switch from "@lib/components/Switch.svelte";
	import Tabs from "@lib/components/Tabs.svelte";
	import type { Category, CategoryGroup } from "@lib/types/actual-schema";
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import { Wallet } from "@lucide/svelte";
	import { onMount } from "svelte";
	import FilterTree from "./FilterTree.svelte";
	import {
		accountSections,
		categorySections,
		loadAccountLayout,
		type AccountLayout,
		type FilterAccount,
	} from "./filter-trees";
	import { CLEARED, type CalendarFilters, type Flow } from "./filters";

	let {
		open = $bindable(false),
		filters,
		accounts,
		categories,
		categoryGroups,
		onChange,
	}: {
		open?: boolean;
		filters: CalendarFilters;
		accounts: FilterAccount[];
		categories: Pick<Category, "id" | "name" | "group">[];
		categoryGroups: Pick<CategoryGroup, "id" | "name">[];
		onChange: (patch: Partial<CalendarFilters>) => void;
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
		filters.flow !== "all" ||
			!filters.showScheduled ||
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
</script>

{#snippet accountIcon(account: FilterAccount)}
	{@const icon = layout.icons[account.id]}
	{#if icon}
		<img
			class="cf__img"
			src={icon.type === "emoji" ? getEmojiAssetUrl(icon.value) : icon.value}
			alt=""
		/>
	{:else}
		<Wallet size={14} strokeWidth={1.75} />
	{/if}
{/snippet}

<button
	type="button"
	class="cf-btn abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
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
	<div class="cf abt-popover" bind:this={menu}>
		<div class="cf__top">
			<span class="cf__title">Filters</span>
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-btn--ghost"
				disabled={!filtering}
				onclick={() => onChange(CLEARED)}>Clear all</button
			>
		</div>
		<div class="abt-seg cf__flow" role="group" aria-label="Show">
			{#each FLOWS as f (f.value)}
				<button
					type="button"
					aria-pressed={filters.flow === f.value}
					onclick={() => onChange({ flow: f.value })}>{f.label}</button
				>
			{/each}
		</div>
		<label class="cf__toggle">
			<span>Scheduled bills</span>
			<Switch
				checked={filters.showScheduled}
				onCheckedChange={(showScheduled) => onChange({ showScheduled })}
			/>
		</label>
		<label class="cf__toggle">
			<span>Off-budget accounts</span>
			<Switch
				checked={!filters.hideOffBudget}
				onCheckedChange={(checked) => onChange({ hideOffBudget: !checked })}
			/>
		</label>
		<label
			class="cf__toggle"
			title="Closing balance each day"
			data-abt-tip-hint="Across the accounts shown"
		>
			<span>Daily balance</span>
			<Switch
				checked={filters.showBalance}
				onCheckedChange={(showBalance) => onChange({ showBalance })}
			/>
		</label>
		<div class="cf__tabs">
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
				/>
			{/if}
		{/key}
	</div>
{/if}

<style>
	.cf-btn {
		position: relative;
	}

	.cf-btn.is-active {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
	}

	/* Marks the button while anything is filtered out, so a thinner month isn't a mystery. */
	.cf-btn.is-filtering::after {
		content: "";
		position: absolute;
		top: 3px;
		right: 3px;
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent);
	}

	.cf {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		width: 340px;
		max-height: min(560px, 75vh);
		padding: var(--abt-space-2);
	}

	.cf__top {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--abt-space-1) var(--abt-space-2) var(--abt-space-3);
	}

	.cf__title {
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
	}

	.cf__flow {
		flex-shrink: 0;
		--abt-btn-h: 26px; /* raw: between the small and default controls */
		display: flex;
		margin: var(--abt-space-1) var(--abt-space-1) var(--abt-space-2);
	}

	.cf__flow > button {
		flex: 1;
		justify-content: center;
	}

	.cf__toggle {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-4);
		padding: var(--abt-space-3);
		border-radius: var(--abt-radius-sm);
		font-size: var(--abt-text-md);
		cursor: pointer;
	}

	.cf__toggle:hover {
		background: var(--abt-fill-hover);
	}

	.cf__tabs {
		flex-shrink: 0;
		margin: var(--abt-space-2) 0 var(--abt-space-3);
	}

	.cf__img {
		width: 16px;
		height: 16px;
		object-fit: cover;
		border-radius: 2px;
	}
</style>
