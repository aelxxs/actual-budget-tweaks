<script lang="ts">
	import { openInsights } from "@features/workflows/template-plan";
	import { templatePlanState } from "@features/workflows/template-plan/state.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import ActionCard from "./ActionCard.svelte";
	import Breakdown from "./Breakdown.svelte";
	import NativeRoll from "./NativeRoll.svelte";
	import { smoothRow } from "./smooth-row";
	import { summaryState } from "./state.svelte";
	import { cachedTotals, loadMonthTotals, type MonthTotals } from "./totals";

	const { sheet }: { sheet: string } = $props();

	// svelte-ignore state_referenced_locally
	let totals = $state<MonthTotals | null>(cachedTotals(sheet));
	let root = $state<HTMLElement | null>(null);

	// Tints Actual's own To Budget card, which sits outside this component.
	$effect(() => {
		const card = root?.closest("[data-abt-summary-row]");
		if (!card || !totals) return;
		card.toggleAttribute("data-abt-to-budget-negative", totals.toBudget < 0);
		return () => card.removeAttribute("data-abt-to-budget-negative");
	});

	const toBudgetCard = $derived(root?.closest("[data-abt-summary-row]")?.lastElementChild ?? null);

	// The To Budget card and ours, eased between widths when content outgrows their floors.
	$effect(() => {
		const card = toBudgetCard as HTMLElement | null;
		const ours = root;
		if (!card || !ours) return;
		return smoothRow(() => [
			card,
			...ours.querySelectorAll<HTMLElement>(":scope > .sr__card, :scope > .ac"),
		]);
	});
	// Re-found when the totals change, in case Actual re-rendered the amount as a new element.
	const toBudgetAmount = $derived(
		totals && toBudgetCard
			? toBudgetCard.querySelector<HTMLElement>("[data-cellname] > span")
			: null,
	);

	function portal(node: HTMLElement, target: Element = document.body) {
		target.appendChild(node);
		return { destroy: () => node.remove() };
	}

	$effect(() => {
		void summaryState.versions[sheet];
		let stale = false;
		loadMonthTotals(sheet)
			.then((t) => {
				if (!stale) totals = t;
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});
</script>

{#if totals}
	{#if toBudgetAmount}
		{#key toBudgetAmount}
			<NativeRoll source={toBudgetAmount} resetKey={sheet} />
		{/key}
	{/if}
	<div class="sr" bind:this={root}>
		{#if templatePlanState.enabled && toBudgetCard}
			<button
				type="button"
				class="sr__more abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
				data-abt-summary-more
				title="Month breakdown in Insights"
				aria-label="Month breakdown in Insights"
				use:portal={toBudgetCard}
				onclick={() => openInsights("overview")}
			>
				<Icon name="layout" size={17} />
			</button>
		{:else if toBudgetCard}
			<!-- The breakdown lives in Insights when it's on; the hover only stands in without it. -->
			<Breakdown anchors={[toBudgetCard]} {sheet} {totals} />
		{/if}
		<div class="sr__card abt-card abt-stack">
			<span class="sr__label abt-label">Spent</span>
			<RollingNumber value={totals.spent} resetKey={sheet} class="sr__value abt-num abt-privacy-number" />
			{#if totals.overIds.length}
				<span
					class="sr__sub abt-cluster abt-gap-2 is-bad"
					title="Overspending comes out of next month's To Budget unless you cover it"
				>
					<i class="sr__dot"></i><RollingNumber
						value={totals.overspentNow}
						resetKey={sheet}
						class="abt-privacy-number"
					/>
					overspent · {totals.overIds.length}
					{totals.overIds.length === 1 ? "category" : "categories"}
				</span>
			{:else}
				<span class="sr__sub abt-cluster abt-gap-2">
					{#if totals.budgeted > 0}
						of <RollingNumber
							value={totals.budgeted}
							resetKey={sheet}
							class="abt-privacy-number"
						/> budgeted
					{:else}
						Nothing budgeted yet
					{/if}
				</span>
			{/if}
		</div>
		{#if totals.goals}
			<div
				class="sr__card sr__targets abt-card abt-stack"
				title="{totals.funded} of {totals.goals} targets funded"
			>
				<span class="sr__label abt-label">Targets funded</span>
				<span class="sr__targets-row abt-cluster">
					<span class="sr__bar"><i style:width="{(totals.funded / totals.goals) * 100}%"></i></span>
					<span class="sr__count abt-num"
						><RollingNumber value={totals.funded} format={String} resetKey={sheet} />/<RollingNumber
							value={totals.goals}
							format={String}
							resetKey={sheet}
						/></span
					>
				</span>
				<span class="sr__sub abt-cluster abt-gap-2">
					{#if totals.short.length}
						Needs <RollingNumber
							value={totals.short.reduce((t, c) => t + c.shortfall, 0)}
							resetKey={sheet}
							class="abt-privacy-number"
						/>
					{:else}
						All targets met
					{/if}
				</span>
			</div>
		{/if}
		<ActionCard
			{sheet}
			toBudget={totals.toBudget}
			short={totals.short}
			overIds={totals.overIds}
			overspent={totals.overspentNow}
		/>
	</div>
{:else}
	<!-- Same shape as the real cards, so loading a month never changes the row's height. -->
	<div class="sr" aria-hidden="true">
		{#each [0, 1, 2] as i (i)}
			<div class="sr__card abt-card abt-stack is-skeleton">
				<span class="sr__label">&nbsp;</span>
				<span class="sr__value">&nbsp;</span>
				<span class="sr__sub">&nbsp;</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* The cards are items of Actual's month card, which lays out the row; this sizes them. */
	.sr {
		display: contents;
	}

	/*
	 * Cards size to their content; the Targets card, whose bar can stretch or shrink, takes the
	 * slack. So a longer suggestion only resizes that bar, nothing moves the To Budget or Spent
	 * cards, and secondary lines truncate only once the bar is at its minimum.
	 */
	.sr > :global(*) {
		order: 1;
		flex: 0 1 auto;
		min-width: 0;
	}

	/* Narrowest that still fits its label, a short bar, the count and "Needs …". */
	.sr > .sr__targets {
		flex: 1 1 0;
		min-width: 150px;
	}

	/* Without targets, the suggestion card takes the slack instead. */
	.sr:not(:has(> .sr__targets)) > :global(.ac) {
		flex-grow: 1;
	}

	/* Floors that cover their usual content, so ordinary changes don't resize them. */
	.sr > :global(.ac) {
		min-width: 210px;
	}

	.sr > .sr__card:not(.sr__targets) {
		min-width: 160px;
	}

	.sr__card {
		--abt-pad: var(--abt-space-3) var(--abt-space-5);
		justify-content: center;
	}

	/* Fixed line heights keep every card, placeholders included, at the row's shared height. */
	.sr__label {
		line-height: 14px;
	}

	/* Rendered by RollingNumber, so outside this component's scope. */
	.sr :global(.sr__value) {
		line-height: 22px;
		font-size: var(--abt-text-xl);
		font-weight: 600;
		color: var(--color-pageText);
	}

	/* A plain line, not a flex row, so it can end in an ellipsis when the card is tight. */
	.sr .sr__sub {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		height: 16px;
		line-height: 16px;
		font-size: 12px;
		color: var(--color-pageTextSubdued);
		white-space: nowrap;
	}

	.sr__sub.is-bad {
		color: var(--color-errorText);
	}

	.sr__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
			display: inline-block;
		margin-right: var(--abt-space-2);
		vertical-align: 1px;
	}

	.sr__card.is-skeleton {
		min-width: 120px;
	}

	.sr__card.is-skeleton > span {
		width: 60%;
		border-radius: 4px;
		background: var(--abt-panel-track);
	}

	.sr__card.is-skeleton > span + span {
		width: 80%;
	}

	/* Sits in Actual's To Budget card, so it's placed against that card's corner. */
	.sr__more {
		position: absolute;
		top: var(--abt-space-2);
		right: var(--abt-space-2);
	}

	.sr__targets {
		flex-basis: 140px;
	}

	.sr__targets-row {
		flex-wrap: nowrap;
		height: 22px;
	}

	.sr__count {
		font-size: var(--abt-text-md);
		font-weight: 600;
		color: var(--color-pageTextSubdued);
	}

	.sr__bar {
		flex: 1;
		min-width: 60px;
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
		transition: width 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.sr__bar i {
			transition: none;
		}
	}
</style>
