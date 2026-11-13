<script lang="ts">
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { currentMonth, monthToSheet } from "@lib/utilities/months";
	import { summaryState } from "./state.svelte";
	import { cachedTrackingTotals, loadTrackingTotals, type TrackingTotals } from "./totals";

	const { month }: { month: string } = $props();

	const sheet = $derived(monthToSheet(month));
	const year = $derived(month.slice(0, 4));
	const tag = $derived.by(() => {
		const current = currentMonth();
		return month === current ? "Now" : month > current ? "Plan" : null;
	});
	const projected = $derived(month >= currentMonth());

	let totals = $derived<TrackingTotals | null>(cachedTrackingTotals(sheet));
	const value = $derived(totals ? (projected ? totals.projected : totals.saved) : 0);

	/** How full a pie reads, as Actual's own: full when there's money but nothing budgeted. */
	const fill = (amount: number, budgeted: number) =>
		budgeted > 0 ? Math.min(1, Math.max(0, amount / budgeted)) : amount > 0 ? 1 : 0;

	// Spending against income: what's left over, or how far spending went past it.
	const flow = $derived.by(() => {
		if (!totals) {
			return [];
		}
		const { income, spent } = totals;
		const segments =
			spent <= income
				? [
						{ kind: "spent", value: spent },
						{ kind: "left", value: income - spent },
					]
				: [
						{ kind: "spent", value: income },
						{ kind: "over", value: spent - income },
					];
		return segments.filter((seg) => seg.value > 0);
	});

	$effect(() => {
		void summaryState.versions[sheet];
		let stale = false;
		loadTrackingTotals(sheet)
			.then((t) => {
				if (!stale) {
					totals = t;
				}
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});
</script>

<span class="tm__year">{year}</span>
{#if tag}<span class="tm__tag" class:is-plan={tag === "Plan"}>{tag}</span>{/if}
<span class="tm__saved">
	<span class="tm__label"
		>{projected ? "Projected savings" : value < 0 ? "Overspent" : "Saved"}</span
	>
	{#if totals}
		<RollingNumber
			{value}
			resetKey={sheet}
			class="tm__amount abt-privacy-number"
			data-sign={value < 0 ? "neg" : value > 0 ? "pos" : "zero"}
		/>
	{/if}
</span>
{#if totals}
	<span class="tm__stats">
		<span class="tm__stat" title="Income received compared with income budgeted"
			><span class="tm__pie is-income" style:--fill={fill(totals.income, totals.incomeBudgeted)}
			></span><span class="tm__label">Income</span><RollingNumber
				value={totals.income}
				resetKey={sheet}
				class="tm__figure abt-privacy-number"
			/></span
		>
		<span class="tm__stat" title="Spending compared with spending budget"
			><span
				class="tm__pie is-spent"
				class:is-over={totals.spentBudgeted > 0 && totals.spent > totals.spentBudgeted}
				style:--fill={fill(totals.spent, totals.spentBudgeted)}
			></span><span class="tm__label">Spent</span><RollingNumber
				value={totals.spent}
				resetKey={sheet}
				class="tm__figure abt-privacy-number"
			/></span
		>
	</span>
	<span class="tm__flow" aria-hidden="true">
		{#each flow as seg (seg.kind)}
			<i class="is-{seg.kind}" style:flex-grow={seg.value}></i>
		{/each}
	</span>
{/if}

<style>
	/* The card is a grid (see index.ts); these are its cells for ABT's parts. */
	.tm__year {
		grid-area: 1 / 2;
		align-self: baseline;
		white-space: nowrap;
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-muted);
	}

	@container (max-width: 260px) {
		.tm__year {
			display: none;
		}
	}

	/* Centred on the month name; on its baseline, a small pill reads as sitting low. */
	.tm__tag {
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

	.tm__tag.is-plan {
		background: var(--abt-fill);
		color: var(--abt-muted);
	}

	/* Where envelope's To Budget sits: label, then the amount on its baseline. */
	.tm__saved {
		grid-area: 2 / 1 / 3 / 4;
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-2);
		min-width: 0;
		font-size: var(--abt-text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-tableHeaderText);
	}

	/* Where envelope's suggested action sits. */
	.tm__stats {
		grid-area: 2 / 4 / 3 / 6;
		justify-self: end;
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-5);
		min-width: 0;
		white-space: nowrap;
	}

	.tm__stat {
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-2);
		font-size: var(--abt-text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-tableHeaderText);
	}

	/* Actual's own income and expense pies, small: how much of the budget each has reached. */
	.tm__pie {
		align-self: center;
		flex-shrink: 0;
		width: 12px;
		height: 12px;
		border-radius: var(--abt-radius-pill);
		background: conic-gradient(var(--pie) calc(var(--fill) * 360deg), var(--abt-panel-track) 0);
	}

	.tm__pie.is-income {
		--pie: var(--color-noticeTextLight);
	}

	.tm__pie.is-spent {
		--pie: var(--abt-accent);
	}

	.tm__pie.is-over {
		--pie: var(--color-errorText);
	}

	.tm__stats :global(.tm__figure) {
		font-size: var(--abt-text-base);
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
	}

	/* Too narrow for both the savings and the figures; the bar still shows the month's shape. */
	@container (max-width: 420px) {
		.tm__stats {
			display: none;
		}
	}

	/*
	 * Positioned rather than a grid row, as on envelope cards: it lives in the card's bottom
	 * padding, so the card keeps the height it shares with the single-month row.
	 */
	.tm__flow {
		position: absolute;
		left: var(--abt-space-5);
		right: var(--abt-space-3);
		bottom: var(--abt-space-2);
		display: flex;
		align-items: flex-end;
		gap: var(--abt-space-1);
		box-sizing: border-box;
		height: var(--abt-space-4);
		padding-bottom: var(--abt-space-2);
	}

	.tm__flow i {
		height: 3px;
		flex: 0 1 0;
		min-width: 4px;
		border-radius: 1.5px;
	}

	.tm__flow .is-spent {
		background: var(--abt-accent);
	}

	.tm__flow .is-left {
		background: var(--color-noticeTextLight);
	}

	.tm__flow .is-over {
		background: var(--color-errorText);
	}

	/* Narrow months keep the amount and drop the label. */
	@container (max-width: 320px) {
		.tm__label {
			display: none;
		}
	}

	.tm__saved :global(.tm__amount) {
		font-size: var(--abt-text-lg);
		font-weight: 650;
		letter-spacing: 0;
		text-transform: none;
		font-variant-numeric: tabular-nums;
		color: var(--color-pageText);
	}

	.tm__saved :global(.tm__amount[data-sign="pos"]) {
		color: var(--color-noticeTextLight);
	}

	.tm__saved :global(.tm__amount[data-sign="neg"]) {
		color: var(--color-errorText);
	}
</style>
