<script lang="ts">
	import { currentMonth, monthToSheet } from "@lib/utilities/months";
	import ActionCard from "./ActionCard.svelte";
	import Breakdown from "./Breakdown.svelte";
	import { summaryState } from "./state.svelte";
	import { cachedTotals, loadMonthTotals, type MonthTotals } from "./totals";

	const { card, month }: { card: HTMLElement; month: string } = $props();

	const sheet = $derived(monthToSheet(month));
	const year = $derived(month.slice(0, 4));
	const tag = $derived.by(() => {
		const current = currentMonth();
		return month === current ? "Now" : month > current ? "Plan" : null;
	});

	// svelte-ignore state_referenced_locally
	let totals = $state<MonthTotals | null>(cachedTotals(sheet));

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

	$effect(() => {
		if (!totals) return;
		card.toggleAttribute("data-abt-to-budget-negative", totals.toBudget < 0);
		return () => card.removeAttribute("data-abt-to-budget-negative");
	});

	const anchor = $derived(card.lastElementChild);
	let flow = $state<HTMLElement | null>(null);

	// Segmented like the calendar's bars; empty ones are left out so the gaps stay even.
	const flowSegments = $derived(
		totals
			? [
					{ kind: "budgeted", value: totals.budgeted },
					{ kind: "overspent", value: totals.overspent },
					{ kind: "next", value: totals.nextMonth },
					{ kind: "left", value: Math.max(totals.toBudget, 0) },
				].filter((seg) => seg.value > 0)
			: [],
	);
</script>

<span class="mm__year">{year}</span>
{#if tag}<span class="mm__tag" class:is-plan={tag === "Plan"}>{tag}</span>{/if}
{#if totals}
	<!-- Where the month's money went, at a glance; the To Budget hover has the figures. -->
	<span class="mm__flow" aria-hidden="true" bind:this={flow}>
		{#each flowSegments as seg (seg.kind)}
			<i class="is-{seg.kind}" style:flex-grow={seg.value}></i>
		{/each}
	</span>
	{#if anchor && flow}<Breakdown anchors={[anchor, flow]} {sheet} {totals} />{/if}
{/if}
<div class="mm__actions">
	<ActionCard
		compact
		loading={!totals}
		{sheet}
		toBudget={totals?.toBudget ?? 0}
		short={totals?.short ?? []}
		overIds={totals?.overIds ?? []}
		overspent={totals?.overspentNow ?? 0}
	/>
</div>

<style>
	/* On the month name's baseline, not centred beside it. */
	/* The card is a grid (see index.ts); these are its cells for ABT's parts. */
	.mm__actions {
		grid-area: 2 / 5;
		justify-self: end;
	}

	/*
	 * Positioned rather than a grid row: it lives in the card's bottom padding, so the card
	 * keeps the height it shares with the single-month row.
	 */
	.mm__flow {
		position: absolute;
		left: var(--abt-space-5);
		right: var(--abt-space-3);
		bottom: var(--abt-space-2);
		display: flex;
		align-items: flex-end;
		gap: var(--abt-space-1);
		box-sizing: border-box;
		/* A taller hover target than the 3px pills, which sit at its bottom. */
		height: var(--abt-space-4);
		padding-bottom: var(--abt-space-2);
		cursor: default;
	}

	.mm__flow i {
		height: 3px;
		flex: 0 1 0;
		min-width: 4px;
		border-radius: 1.5px;
	}

	.mm__flow .is-budgeted {
		background: var(--abt-accent);
	}

	.mm__flow .is-overspent {
		background: var(--color-errorText);
	}

	.mm__flow .is-next {
		background: var(--color-warningText);
	}

	.mm__flow .is-left {
		background: var(--abt-ink-4);
	}

	/* On the month name's baseline, like a continuation of it. */
	.mm__year {
		grid-area: 1 / 2;
		align-self: baseline;
		white-space: nowrap;
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--color-pageTextSubdued);
	}

	@container (max-width: 260px) {
		.mm__year {
			display: none;
		}
	}

	/* Centred on the month name; on its baseline, a small pill reads as sitting low. */
	.mm__tag {
		grid-area: 1 / 3;
		align-self: center;
		justify-self: start;
		white-space: nowrap;
		padding: var(--abt-space-1) var(--abt-space-3);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent-3);
		color: var(--abt-accent);
		font-size: var(--abt-text-xs);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.mm__tag.is-plan {
		background: var(--abt-fill);
		color: var(--abt-muted);
	}
</style>
