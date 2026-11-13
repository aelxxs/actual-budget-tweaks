<script lang="ts">
	import { runway, usesGoalTemplates } from "@features/workflows/template-plan/overview";
	import { templatePlanState } from "@features/workflows/template-plan/state.svelte";
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { ArrowLeftRight } from "@lucide/svelte";
	import { type CategoryIcons, followCategoryIcons } from "@lib/utilities/category-icons";
	import { untrack } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import SlotMenu from "./SlotMenu.svelte";
	import {
		type Change,
		type IncomeTotals,
		type PinnedTotals,
		USUAL_MONTHS,
		changeCache,
		incomeCache,
		loadBiggestChange,
		loadIncome,
		loadPinned,
		nextMonthPlan,
		pinnedCache,
	} from "./slot-data";
	import { type SlotCardId, slotLabel } from "./slots";
	import { slotStore, summaryState } from "./state.svelte";
	import type { MonthTotals, TrackingTotals } from "./totals";

	const {
		slot,
		sheet,
		totals,
		tracking = false,
	}: {
		/** Which of the two slots, 0 or 1. */
		slot: 0 | 1;
		sheet: string;
		totals: MonthTotals | TrackingTotals;
		tracking?: boolean;
	} = $props();

	const id = $derived(summaryState.slots.cards[slot]);
	const other = $derived(summaryState.slots.cards[1 - slot]);
	const pinnedId = $derived(summaryState.slots.pinned);
	const version = $derived(summaryState.versions[sheet] ?? 0);
	const spentBudgeted = $derived(
		"spentBudgeted" in totals ? totals.spentBudgeted : totals.budgeted,
	);

	let card = $state<HTMLElement | null>(null);
	let icons = $state<CategoryIcons>({});
	$effect(() => followCategoryIcons((next) => (icons = next)));
	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	let menuOpen = $state(false);
	let menuStart = $state<"cards" | "categories">("cards");

	function pick(next: SlotCardId, pinned?: string) {
		menuOpen = false;
		const cards = [...summaryState.slots.cards] as [SlotCardId, SlotCardId];
		// Picking the other slot's card swaps the two.
		if (next === other) {
			cards[1 - slot] = id;
		}
		cards[slot] = next;
		summaryState.slots = { cards, pinned: pinned ?? summaryState.slots.pinned };
		slotStore.save($state.snapshot(summaryState.slots));
	}

	// ── Per-card data, each read only while its card shows ──────────
	let pinned = $state<PinnedTotals | null>(null);
	let income = $state<IncomeTotals | null>(null);
	let change = $state<Change | null | undefined>(undefined);

	function follow<T>(
		key: string,
		cache: { get: (k: string) => T | null },
		load: () => Promise<T>,
		set: (v: T) => void,
	) {
		const hit = cache.get(key);
		if (hit !== null) {
			set(hit);
		}
		let stale = false;
		load()
			.then((v) => !stale && set(v))
			.catch(() => {});
		return () => {
			stale = true;
		};
	}

	$effect(() => {
		void version;
		if (id === "pinned" && pinnedId) {
			return follow(
				`${sheet}:${pinnedId}`,
				pinnedCache,
				() => loadPinned(sheet, pinnedId),
				(v) => (pinned = v),
			);
		}
		if (id === "income") {
			return follow(
				sheet,
				incomeCache,
				() => loadIncome(sheet),
				(v) => (income = v),
			);
		}
		if (id === "change") {
			return follow(
				sheet,
				changeCache,
				() => loadBiggestChange(sheet),
				(v) => (change = v),
			);
		}
	});

	// Months ahead is Insights' Next Month walk, run for the shown month even with the panel closed.
	const runwayOn = $derived(id === "runway" && templatePlanState.enabled && !tracking);
	$effect(() => {
		if (!runwayOn) {
			return;
		}
		untrack(() => templatePlanState.overviewWanted++);
		return () => untrack(() => templatePlanState.overviewWanted--);
	});
	$effect(() => {
		void version;
		if (runwayOn) {
			// Untracked: the overview it loads would otherwise ask for itself again, and each new
			// request cancels the months-ahead walk before it finishes.
			untrack(() =>
				templatePlanState.loadOverview?.(templatePlanState.overviewData?.sheet === sheet),
			);
		}
	});

	// A month Insights worked out ahead draws at once, before its refresh gets going.
	const overview = $derived(
		templatePlanState.overviewData?.sheet === sheet
			? templatePlanState.overviewData
			: (templatePlanState.peekOverview?.(sheet) ?? null),
	);
	const goalTemplates = $derived(!!overview && usesGoalTemplates(overview));
	const plan = $derived(overview ? nextMonthPlan(overview, goalTemplates) : null);
	const ahead = $derived(
		overview && plan && plan.need !== null
			? runway(overview.nextMonthKey, plan.held, [plan.need, ...plan.later])
			: null,
	);
	const aheadLoading = $derived(
		!overview || (goalTemplates && overview.aheadTemplateNeeds === null),
	);

	const monthName = (key: string, year = false) => {
		const [y, m] = key.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
			month: "short",
			year: year ? "numeric" : undefined,
		});
	};

	const pct = (part: number, whole: number) =>
		whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0;

	const label = $derived(
		id === "pinned" && pinned
			? pinned.name
			: id === "runway" && ahead && !aheadLoading && ahead.lastCovered < 0
				? "Next month"
				: id === "runway" && ahead && !aheadLoading
					? "Covered through"
					: slotLabel(id),
	);
	const stretches = $derived(["targets", "runway", "pinned", "income"].includes(id));
</script>

<div
	class="sr__card abt-card abt-stack"
	class:sr__flex={stretches}
	class:sr__targets={id === "targets"}
	data-slot-card={id}
	bind:this={card}
>
	{#key `${id}:${id === "pinned" ? pinnedId : ""}`}
		<!-- A new card rises into place, so the change reads as the card being swapped. -->
		<div class="sr__body" in:fly={{ y: 8, duration: still ? 0 : 260, easing: cubicOut }}>
			<span class="sr__label abt-label">
				{#if id === "pinned" && pinnedId && icons[pinnedId]}
					<img class="sr__icon" src={icons[pinnedId].value} alt="" />
				{/if}{label}
			</span>

			{#if id === "spent"}
				<RollingNumber
					value={totals.spent}
					resetKey={sheet}
					class="sr__value abt-num abt-privacy-number"
				/>
				<span class="sr__sub">
					{#if spentBudgeted > 0}
						of <RollingNumber value={spentBudgeted} resetKey={sheet} class="abt-privacy-number" /> budgeted
					{:else}
						Nothing budgeted yet
					{/if}
				</span>
			{:else if id === "targets"}
				{#if totals.goals}
					{@const needs = totals.short.reduce((t, c) => t + c.shortfall, 0)}
					<span class="sr__row" title="{totals.funded} of {totals.goals} targets funded">
						<span class="sr__bar"><i style:width="{pct(totals.funded, totals.goals)}%"></i></span>
						<span class="sr__count abt-num"
							><RollingNumber
								value={totals.funded}
								format={String}
								resetKey={sheet}
							/>/<RollingNumber value={totals.goals} format={String} resetKey={sheet} /></span
						>
					</span>
					<span class="sr__sub">
						{#if totals.short.length}
							Needs <RollingNumber value={needs} resetKey={sheet} class="abt-privacy-number" />
							{#if totals.fromMoves >= needs}
								· from moving money
							{:else if totals.fromMoves > 0}
								· <span class="abt-privacy-number">{fmtMoney(totals.fromMoves)}</span> from moving money
							{/if}
						{:else}
							All targets met
							{#if totals.settled}
								· <span class="abt-privacy-number">{fmtMoney(totals.fromMoves)}</span> moved to other
								categories
							{/if}
						{/if}
					</span>
				{:else}
					<span class="sr__value abt-num sr__none">None</span>
					<span class="sr__sub">No category has a target</span>
				{/if}
			{:else if id === "runway"}
				{#if tracking}
					<span class="sr__value abt-num sr__none">Off</span>
					<span class="sr__sub">Unavailable in tracking budgets</span>
				{:else if !templatePlanState.enabled}
					<span class="sr__value abt-num sr__none">Off</span>
					<span class="sr__sub">Turn on Insights to see this</span>
				{:else if aheadLoading}
					<!-- Before the answer: until the months ahead are in, it would stop at next month. -->
					<span class="sr__value abt-skeleton sr__ghost"></span>
					<span class="sr__sub abt-skeleton sr__ghost"></span>
				{:else if ahead}
					{@const covered = ahead.lastCovered >= 0}
					<span class="sr__row">
						<span class="sr__value abt-num">
							{covered
								? monthName(ahead.months[ahead.lastCovered].key, true)
								: `${Math.round(ahead.months[0].fill * 100)}%`}
						</span>
						<span class="sr__strip" class:is-short={!covered}>
							{#each ahead.months.slice(0, 6) as month (month.key)}
								<span class="sr__bar"><i style:width="{month.fill * 100}%"></i></span>
							{/each}
						</span>
					</span>
					<span class="sr__sub">
						{#if covered}
							<span class="abt-privacy-number">{fmtMoney(plan!.held)}</span> held
						{:else}
							<span class="abt-privacy-number"
								>{fmtMoney(plan!.need! - Math.max(0, plan!.held))}</span
							>
							short for {monthName(ahead.months[0].key)}
						{/if}
					</span>
				{:else}
					<span class="sr__value abt-num sr__none">—</span>
					<span class="sr__sub">Not enough to work out next month</span>
				{/if}
			{:else if id === "pinned"}
				{#if pinned}
					<span class="sr__row">
						<span class="sr__value abt-num" class:is-over={pinned.balance < 0}>
							<span class="abt-privacy-number">{fmtMoney(Math.abs(pinned.balance))}</span>
							<small>{pinned.balance < 0 ? "over" : "left"}</small>
						</span>
						{#if pinned.budgeted > 0}
							<span class="sr__bar"
								><i style:width="{pct(pinned.spent, pinned.budgeted)}%"></i></span
							>
						{/if}
					</span>
					<span class="sr__sub">
						Spent <span class="abt-privacy-number">{fmtMoney(pinned.spent)}</span>
						{#if pinned.budgeted > 0}
							of <span class="abt-privacy-number">{fmtMoney(pinned.budgeted)}</span>
						{/if}
					</span>
				{:else}
					<button
						type="button"
						class="sr__value sr__choose"
						onclick={() => {
							menuStart = "categories";
							menuOpen = true;
						}}
					>
						Choose a category
					</button>
					<span class="sr__sub">Its balance shows here</span>
				{/if}
			{:else if id === "income"}
				{#if income}
					<span class="sr__row">
						<RollingNumber
							value={income.received}
							resetKey={sheet}
							class="sr__value abt-num abt-privacy-number"
						/>
						{#if income.usual}
							<span class="sr__bar"
								><i style:width="{pct(income.received, income.usual)}%"></i></span
							>
						{/if}
					</span>
					<span class="sr__sub">
						{#if income.usual}
							{Math.round((income.received / income.usual) * 100)}% of your {USUAL_MONTHS}-month
							usual
						{:else}
							Nothing earlier to compare
						{/if}
					</span>
				{:else}
					<span class="sr__value abt-skeleton sr__ghost"></span>
					<span class="sr__sub abt-skeleton sr__ghost"></span>
				{/if}
			{:else if id === "change"}
				{#if change}
					<span class="sr__value abt-num sr__change">
						<span class="sr__change-name">{change.name}</span>
						+{Math.round(change.rise * 100)}%
					</span>
					<span class="sr__sub">vs your {USUAL_MONTHS}-month usual</span>
				{:else if change === null}
					<span class="sr__value abt-num sr__none">None</span>
					<span class="sr__sub">No category above its usual</span>
				{:else}
					<span class="sr__value abt-skeleton sr__ghost"></span>
					<span class="sr__sub abt-skeleton sr__ghost"></span>
				{/if}
			{/if}
		</div>
	{/key}

	<button
		type="button"
		class="sr__swap abt-btn abt-btn--sm abt-btn--icon"
		class:is-open={menuOpen}
		aria-label="Change this card"
		aria-haspopup="menu"
		aria-expanded={menuOpen}
		onclick={() => {
			menuStart = "cards";
			menuOpen = !menuOpen;
		}}
	>
		<ArrowLeftRight size={14} />
	</button>
</div>

{#if menuOpen && card}
	<SlotMenu
		anchor={card.querySelector<HTMLElement>(".sr__swap") ?? card}
		{slot}
		{sheet}
		{totals}
		{tracking}
		runwayPreview={ahead && !aheadLoading
			? ahead.lastCovered >= 0
				? monthName(ahead.months[ahead.lastCovered].key, true)
				: `${Math.round(ahead.months[0].fill * 100)}%`
			: null}
		current={id}
		start={menuStart}
		{other}
		pinned={pinnedId}
		runwayAvailable={templatePlanState.enabled && !tracking}
		onPick={pick}
		onClose={() => (menuOpen = false)}
	/>
{/if}

<style>
	.sr__card {
		position: relative;
		transition: border-color 0.12s;
	}
	.sr__card:hover,
	.sr__card:has(> .sr__swap.is-open) {
		border-color: var(--abt-ink-5);
	}

	/* The card's lines, spaced as the card spaces them. */
	.sr__body {
		display: flex;
		flex-direction: column;
		gap: inherit;
		min-width: 0;
	}

	.sr__icon {
		width: 12px;
		height: 12px;
		margin-right: 5px;
		vertical-align: -1px;
		object-fit: contain;
		border-radius: 2px;
	}

	/* On hover, like the row's other controls; kept while its menu is open. */
	.sr__swap {
		position: absolute;
		top: var(--abt-space-2);
		right: var(--abt-space-2);
		opacity: 0;
		transition: opacity 0.12s;
	}
	.sr__card:hover .sr__swap,
	.sr__swap:focus-visible,
	.sr__swap.is-open {
		opacity: 1;
	}

	/* A value and its bar on one line, so every card keeps the row's three lines. */
	.sr__row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		height: 22px;
		min-width: 0;
	}

	.sr__count {
		font-size: var(--abt-text-base);
		font-weight: 600;
		color: var(--abt-muted);
	}

	/* Keep supporting text subdued in both envelope and tracking rows. */
	.sr__sub {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		height: 16px;
		line-height: 16px;
		font-size: var(--abt-text-base);
		color: var(--color-tableHeaderText);
		white-space: nowrap;
	}

	.sr__bar {
		flex: 1;
		min-width: 40px;
		height: 6px;
		border-radius: 3px;
		background: var(--abt-panel-track);
		overflow: hidden;
	}

	.sr__bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--color-noticeTextLight);
		/* Same easing and length as the rolling numbers, so the card moves as one. */
		transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	/* Takes what the month name leaves, and drops out when that's too little to read. */
	.sr__strip {
		display: flex;
		flex: 1;
		gap: 3px;
		min-width: 0;
		container-type: inline-size;
	}
	@container (max-width: 72px) {
		.sr__strip .sr__bar {
			display: none;
		}
	}
	.sr__strip .sr__bar {
		min-width: 0;
		height: 5px;
	}
	.sr__strip.is-short .sr__bar i {
		background: var(--color-warningText);
	}

	.sr__value small {
		font-size: var(--abt-text-base);
		font-weight: 500;
		color: var(--abt-muted);
	}
	.sr__value.is-over {
		color: var(--color-errorText);
	}

	.sr__none {
		color: var(--abt-muted);
	}

	.sr__change {
		display: flex;
		gap: var(--abt-space-2);
		min-width: 0;
		white-space: nowrap;
	}
	.sr__change-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sr__value.sr__choose {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--abt-accent-text);
		text-align: left;
		cursor: pointer;
	}

	/* Taking up its line's full height, so the label doesn't move when the answer arrives. */
	.sr__ghost {
		width: 70%;
	}
	.sr__value.sr__ghost {
		height: 14px;
		margin: var(--abt-space-2) 0;
	}
	.sr__sub.sr__ghost {
		width: 85%;
		height: 10px;
		margin: 3px 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.sr__bar i,
		.sr__swap {
			transition: none;
		}
	}
</style>
