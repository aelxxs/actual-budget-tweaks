<script lang="ts">
	import { portal } from "@lib/dom/svelte";
	import { loadCategories } from "@lib/actual/templates/actual-data";
	import type { Category } from "@lib/actual/templates/priority-plan";
	import { readCells } from "@lib/actual/budget-cells";
	import CategoryIcon from "@lib/components/CategoryIcon.svelte";
	import { fmtMoney } from "@lib/format/currency";
	import { onOutsideClick, positionPopover } from "@lib/dom/popover";
	import {
		Banknote,
		CalendarClock,
		Check,
		ChevronLeft,
		ChevronRight,
		type LucideIcon,
		Pin,
		ReceiptText,
		Search,
		Target,
		TrendingUp,
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import { backOut, cubicOut } from "svelte/easing";
	import { fade, fly } from "svelte/transition";
	import {
		type Change,
		type IncomeTotals,
		changeCache,
		incomeCache,
		loadBiggestChange,
		loadIncome,
	} from "./slot-data";
	import { SLOT_CARDS, type SlotCardId, slotLabel } from "./slots";
	import type { MonthTotals, TrackingTotals } from "./totals";

	const {
		anchor,
		slot,
		sheet,
		totals,
		tracking = false,
		runwayPreview,
		current,
		start = "cards",
		other,
		pinned,
		runwayAvailable,
		onPick,
		onClose,
	}: {
		anchor: HTMLElement;
		slot: 0 | 1;
		sheet: string;
		totals: MonthTotals | TrackingTotals;
		tracking?: boolean;
		/** Months ahead's answer, when Insights has worked it out for this month. */
		runwayPreview: string | null;
		current: SlotCardId;
		/** Straight to the category list, from the Pinned card's "Choose a category". */
		start?: "cards" | "categories";
		/** The card in the other slot; picking it swaps the two. */
		other: SlotCardId;
		pinned: string | null;
		/** Months ahead comes from Insights, so it needs Insights on. */
		runwayAvailable: boolean;
		onPick: (id: SlotCardId, pinned?: string) => void;
		onClose: () => void;
	} = $props();

	const ICONS: Record<SlotCardId, LucideIcon> = {
		spent: ReceiptText,
		targets: Target,
		runway: CalendarClock,
		pinned: Pin,
		income: Banknote,
		change: TrendingUp,
	};

	const HINTS: Partial<Record<SlotCardId, string>> = {
		pinned: "Choose a category next",
		income: "Best for irregular pay",
	};

	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const motion = still ? 0 : 220;

	let menu = $state<HTMLElement | null>(null);
	/** 1 going in to the category list, -1 coming back, so the steps slide the way you went. */
	let dir = $state(1);
	let cardsHeight = $state(0);
	let categoriesHeight = $state(0);
	// Eased only after the first measure, so the menu opens at its height.
	let easeHeight = $state(false);

	onMount(() => {
		requestAnimationFrame(() => (easeHeight = true));
	});

	function go(next: "cards" | "categories") {
		dir = next === "categories" ? 1 : -1;
		step = next;
	}

	/** Opens from the swap button's corner. */
	function pop(_node: Element) {
		return {
			duration: still ? 0 : 240,
			easing: backOut,
			css: (t: number, u: number) =>
				`opacity: ${Math.min(1, t * 1.6)}; transform: translateY(${u * -6}px) scale(${0.95 + 0.05 * t});`,
		};
	}
	// svelte-ignore state_referenced_locally
	let step = $state<"cards" | "categories">(start);
	let query = $state("");
	let search = $state<HTMLInputElement | null>(null);
	let categories = $state<Category[]>([]);
	let balances = $state<Map<string, number>>(new Map());
	// svelte-ignore state_referenced_locally
	let income = $state<IncomeTotals | null>(incomeCache.get(sheet));
	// svelte-ignore state_referenced_locally
	let change = $state<Change | null>(changeCache.get(sheet));

	// Each card previewed with this month's numbers, so the choice shows what it would say.
	// svelte-ignore state_referenced_locally
	void loadIncome(sheet).then((v) => (income = v));
	// svelte-ignore state_referenced_locally
	void loadBiggestChange(sheet).then((v) => (change = v));
	void loadCategories().then(async (cats) => {
		categories = cats.filter((c) => !c.hidden && !c.is_income);
		balances = await readCells(
			sheet,
			categories.map((c) => `leftover-${c.id}`),
		);
	});

	const preview = $derived<Record<SlotCardId, string | null>>({
		spent: fmtMoney(totals.spent),
		targets: totals.goals ? `${totals.funded}/${totals.goals}` : null,
		runway: runwayPreview,
		pinned: null,
		income: income?.usual ? `${Math.round((income.received / income.usual) * 100)}%` : null,
		change: change ? `${change.name} +${Math.round(change.rise * 100)}%` : null,
	});

	const stageHeight = $derived(step === "cards" ? cardsHeight : categoriesHeight);

	const matches = $derived(
		categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
	);
	/** The matches under their group headings, in the budget's order. */
	const groups = $derived.by(() => {
		const byGroup = new Map<string, Category[]>();
		for (const cat of matches) {
			byGroup.set(cat.group_name, [...(byGroup.get(cat.group_name) ?? []), cat]);
		}
		return [...byGroup];
	});

	$effect(() => {
		if (step === "categories") {
			search?.focus();
		}
	});

	$effect(() => {
		void step;
		if (!menu) {
			return;
		}
		positionPopover(menu, anchor, { align: "right", gap: 6 });
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		const stop = onOutsideClick([menu, anchor], onClose);
		return () => {
			stop();
			document.removeEventListener("keydown", onKey);
		};
	});

	// The row clips overflow and slides with a transform, so the menu floats on <body>.
</script>

<div
	class="sm abt-popover"
	role="menu"
	use:portal
	bind:this={menu}
	in:pop
	out:fade={{ duration: still ? 0 : 120 }}
>
	<div
		class="sm__stage"
		class:is-easing={easeHeight}
		style:height={stageHeight ? `${stageHeight}px` : undefined}
	>
		{#if step === "cards"}
			<div
				class="sm__pane"
				bind:offsetHeight={cardsHeight}
				in:fly={{ x: 28 * dir, duration: motion, easing: cubicOut }}
				out:fly={{ x: -28 * dir, duration: motion, easing: cubicOut }}
			>
				<div class="sm__head">
					<div class="sm__title">Replace {slotLabel(current)}</div>
					<div class="sm__hint">Card {slot + 1} of 2 you can choose</div>
				</div>
				{#each SLOT_CARDS as card (card.id)}
					{@const Icon = ICONS[card.id]}
					{@const off = card.id === "runway" && (tracking || !runwayAvailable)}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={card.id === current}
						class="sm__row"
						disabled={off}
						onclick={() => (card.id === "pinned" ? go("categories") : onPick(card.id))}
					>
						<span class="sm__tile" data-on={card.id === current || undefined}
							><Icon size={15} /></span
						>
						<span class="sm__label">
							{card.label}
							{#if off}
								<span class="sm__hint">{tracking ? "Envelope only" : "Needs Insights"}</span>
							{:else if card.id === other}
								<span class="sm__hint">In card {2 - slot} · swaps places</span>
							{:else if HINTS[card.id]}
								<span class="sm__hint">{HINTS[card.id]}</span>
							{/if}
						</span>
						{#if preview[card.id] && !off}
							<span class="sm__preview abt-privacy-number">{preview[card.id]}</span>
						{/if}
						{#if card.id === current}
							<Check size={16} class="sm__check" />
						{:else if card.id === "pinned"}
							<ChevronRight size={16} class="sm__chevron" />
						{/if}
					</button>
				{/each}
			</div>
		{:else}
			<div
				class="sm__pane"
				bind:offsetHeight={categoriesHeight}
				in:fly={{ x: 28 * dir, duration: motion, easing: cubicOut }}
				out:fly={{ x: -28 * dir, duration: motion, easing: cubicOut }}
			>
				<button type="button" class="sm__back" onclick={() => go("cards")}>
					<ChevronLeft size={16} />
					<span class="sm__title">Pin a category</span>
				</button>
				<span class="sm__search">
					<Search size={14} strokeWidth={1.75} />
					<input
						class="abt-input"
						type="search"
						placeholder="Search categories"
						aria-label="Search categories"
						bind:value={query}
						bind:this={search}
						onkeydown={(e) => {
							if (e.key === "Enter" && matches.length) {
								onPick("pinned", matches[0].id);
							}
						}}
					/>
				</span>
				<div class="sm__list">
					{#each groups as [group, cats] (group)}
						<div class="sm__group">{group}</div>
						{#each cats as cat (cat.id)}
							{@const balance = balances.get(`leftover-${cat.id}`)}
							<button
								type="button"
								role="menuitemradio"
								aria-checked={cat.id === pinned}
								class="sm__row sm__cat"
								onclick={() => onPick("pinned", cat.id)}
							>
								<CategoryIcon id={cat.id} size={16} />
								<span class="sm__label">{cat.name}</span>
								{#if balance !== undefined}
									<span class="sm__preview abt-privacy-number" class:is-neg={balance < 0}
										>{fmtMoney(balance)}</span
									>
								{/if}
								{#if cat.id === pinned}
									<Check size={16} class="sm__check" />
								{/if}
							</button>
						{/each}
					{:else}
						<div class="sm__empty">No category matches</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Laid out like Insights' card menu, so ABT's menus read as one family. */
	.sm {
		position: fixed;
		z-index: 1000;
		width: 300px;
		padding: var(--abt-space-3);
		transform-origin: top right;
	}

	/* Both steps share one cell while they slide past each other; the height eases between them. */
	.sm__stage {
		display: grid;
		overflow: hidden;
	}
	.sm__stage.is-easing {
		transition: height 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.sm__pane {
		grid-area: 1 / 1;
		align-self: start;
		min-width: 0;
	}

	.sm__head {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		padding: var(--abt-space-2) var(--abt-space-3) var(--abt-space-4);
	}

	.sm__title {
		font-size: var(--abt-text-md);
		font-weight: 600;
	}

	.sm__hint {
		overflow: hidden;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sm__row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		width: 100%;
		padding: var(--abt-space-3);
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.12s;
	}
	.sm__row:hover:not(:disabled) {
		background: var(--abt-fill);
	}
	.sm__row:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.sm__tile {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-ink-2);
		color: var(--abt-subtle);
		transition:
			background 0.2s,
			color 0.2s;
	}
	.sm__tile[data-on] {
		background: var(--abt-accent-2);
		color: var(--abt-accent);
	}

	.sm__label {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
		font-size: var(--abt-text-md);
	}

	.sm__preview {
		flex: none;
		max-width: 45%;
		overflow: hidden;
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sm__preview.is-neg {
		color: var(--color-errorText);
	}

	.sm :global(.sm__check) {
		flex: none;
		color: var(--abt-accent);
	}

	.sm :global(.sm__chevron) {
		flex: none;
		color: var(--abt-subtle);
	}

	.sm__back {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		width: 100%;
		padding: var(--abt-space-2) var(--abt-space-3) var(--abt-space-4);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.sm__back :global(svg) {
		color: var(--abt-subtle);
	}

	/* The category list follows the calendar filter's (FilterTree): its search, headings and indent. */
	.sm__search {
		position: relative;
		display: flex;
		align-items: center;
		padding: 0 var(--abt-space-1) var(--abt-space-2);
		color: var(--abt-muted);
	}
	.sm__search :global(svg) {
		position: absolute;
		left: calc(var(--abt-space-1) + var(--abt-space-3));
		pointer-events: none;
	}
	.sm__search input {
		flex: 1;
		min-width: 0;
		padding-left: calc(var(--abt-space-3) + 20px);
	}

	.sm__group {
		padding: var(--abt-space-2) var(--abt-space-3);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--abt-muted);
	}

	.sm__row.sm__cat {
		gap: var(--abt-space-3);
		padding: var(--abt-space-2) var(--abt-space-3) var(--abt-space-2)
			calc(var(--abt-space-3) + 14px);
	}
	.sm__row.sm__cat:hover {
		background: var(--abt-fill-hover);
	}

	.sm__list {
		display: flex;
		flex-direction: column;
		max-height: 300px;
		overflow-y: auto;
	}

	.sm__empty {
		padding: var(--abt-space-3) var(--abt-space-2);
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.sm__stage.is-easing,
		.sm__row,
		.sm__tile {
			transition: none;
		}
	}
</style>
