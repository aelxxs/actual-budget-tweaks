<script lang="ts">
	import { CELL } from "@lib/actual-dom";
	import { openInsights } from "@features/workflows/template-plan";
	import { templatePlanState } from "@features/workflows/template-plan/state.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import ActionCard from "./ActionCard.svelte";
	import Breakdown from "./Breakdown.svelte";
	import NativeRoll from "./NativeRoll.svelte";
	import SlotCard from "./SlotCard.svelte";
	import { smoothRow } from "./smooth-row";
	import { summaryState } from "./state.svelte";
	import { cachedTotals, loadMonthTotals, prefetchNeighbours, type MonthTotals } from "./totals";

	const { sheet }: { sheet: string } = $props();

	let totals = $derived<MonthTotals | null>(cachedTotals(sheet));
	let root = $state<HTMLElement | null>(null);

	// Tints Actual's own To Budget card, which sits outside this component.
	$effect(() => {
		const card = root?.closest("[data-abt-summary-row]");
		if (!card || !totals) {
			return;
		}
		card.toggleAttribute("data-abt-to-budget-negative", totals.toBudget < 0);
		card.setAttribute("data-abt-to-budget-known", "");
		return () => {
			card.removeAttribute("data-abt-to-budget-negative");
			card.removeAttribute("data-abt-to-budget-known");
		};
	});

	const toBudgetCard = $derived(root?.closest("[data-abt-summary-row]")?.lastElementChild ?? null);

	// Lets the card's CSS make room for the shortcut without a :has() rule.
	$effect(() => {
		const card = toBudgetCard?.parentElement;
		if (!card || !templatePlanState.enabled) {
			return;
		}
		card.setAttribute("data-abt-summary-has-more", "");
		return () => card.removeAttribute("data-abt-summary-has-more");
	});

	// The To Budget card and ours, eased between widths when content outgrows their floors.
	$effect(() => {
		const card = toBudgetCard as HTMLElement | null;
		const ours = root;
		if (!card || !ours) {
			return;
		}
		return smoothRow(() => [
			card,
			...ours.querySelectorAll<HTMLElement>(":scope > .sr__card, :scope > .ac"),
		]);
	});
	// Re-found whenever Actual re-renders the card (privacy mode rebuilds the amount), so the
	// rolling copy never stays on a detached element.
	let toBudgetAmount = $state<HTMLElement | null>(null);
	$effect(() => {
		const card = toBudgetCard;
		if (!card || !totals) {
			return;
		}
		let current: HTMLElement | null = null;
		const find = () => {
			const el = card.querySelector<HTMLElement>(`${CELL} > span`);
			if (el !== current) {
				toBudgetAmount = current = el;
			}
		};
		find();
		const watch = new MutationObserver(find);
		watch.observe(card, { childList: true, subtree: true });
		return () => watch.disconnect();
	});

	function portal(node: HTMLElement, target: Element = document.body) {
		target.appendChild(node);
		return { destroy: () => node.remove() };
	}

	$effect(() => {
		void summaryState.versions[sheet];
		let stale = false;
		loadMonthTotals(sheet)
			.then((t) => {
				if (!stale) {
					totals = t;
				}
				prefetchNeighbours(sheet);
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
				title="This month in Insights"
				aria-label="This month in Insights"
				use:portal={toBudgetCard}
				onclick={() => openInsights("overview")}
			>
				<Icon name="layout" size={17} />
			</button>
		{:else if toBudgetCard}
			<!-- The breakdown lives in Insights when it's on; the hover only stands in without it. -->
			<Breakdown anchors={[toBudgetCard]} {sheet} {totals} />
		{/if}
		<SlotCard slot={0} {sheet} {totals} />
		<SlotCard slot={1} {sheet} {totals} />
		<ActionCard
			{sheet}
			toBudget={totals.toBudget}
			short={totals.short}
			overIds={totals.overIds}
			overspent={totals.overspentNow}
			toApply={totals.toApply}
		/>
	</div>
{:else}
	<!-- Laid out like the real row (the two chosen cards, then the suggestion), so the cards
	     replace it in place. -->
	<div class="sr" aria-hidden="true">
		{#each ["", "sr__flex", "is-action"] as kind (kind)}
			<div class="sr__card abt-card abt-stack is-skeleton {kind}">
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
	 * Cards size to their content; cards with a bar, which can stretch or shrink, take the
	 * slack. So a longer suggestion only resizes a bar, nothing moves the To Budget card, and
	 * secondary lines truncate only once the bars are at their minimum.
	 */
	.sr > :global(*) {
		order: 1;
		flex: 0 1 auto;
		min-width: 0;
	}

	/* Narrowest that still fits a label, a short bar, its figure and the line below. */
	.sr > :global(.sr__flex) {
		flex: 1 1 0;
		min-width: 150px;
	}

	/* Without a card that stretches, the suggestion card takes the slack instead. */
	.sr:not(:has(> :global(.sr__flex))) > :global(.ac) {
		flex-grow: 1;
	}

	/* Floors that cover their usual content, so ordinary changes don't resize them. */
	.sr > :global(.ac) {
		min-width: 210px;
	}

	.sr > :global(.sr__card:not(.sr__flex)) {
		min-width: 160px;
	}

	.sr :global(.sr__card) {
		--abt-pad: var(--abt-space-3) var(--abt-space-5);
		justify-content: center;
	}

	/* Fixed line heights keep every card, placeholders included, at the row's shared height. */
	.sr :global(.sr__label) {
		overflow: hidden;
		line-height: 14px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sr :global(.sr__value) {
		line-height: 22px;
		font-size: var(--abt-text-xl);
		font-weight: 600;
		color: var(--color-pageText);
	}

	/* A plain line, not a flex row, so it can end in an ellipsis when the card is tight. */
	.sr :global(.sr__sub) {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		height: 16px;
		line-height: 16px;
		font-size: var(--abt-text-base);
		color: var(--color-tableHeaderText);
		white-space: nowrap;
	}

	.sr > .sr__card.is-action {
		min-width: 210px;
	}

	.sr__card.is-skeleton > span {
		width: 60%;
		border-radius: var(--abt-radius-sm);
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
</style>
