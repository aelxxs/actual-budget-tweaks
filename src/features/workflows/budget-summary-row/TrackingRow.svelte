<script lang="ts">
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { currentMonth } from "@lib/utilities/months";
	import { smoothRow } from "./smooth-row";
	import { summaryState } from "./state.svelte";
	import {
		cachedTrackingTotals,
		expectsTargets,
		loadTrackingTotals,
		prefetchNeighbours,
		type TrackingTotals,
	} from "./totals";

	const { sheet, month }: { sheet: string; month: string } = $props();

	let totals = $derived<TrackingTotals | null>(cachedTrackingTotals(sheet));
	let root = $state<HTMLElement | null>(null);

	// This month and later are still a plan, as in Actual's own card: what's budgeted to be left.
	const projected = $derived(month >= currentMonth());
	const lead = $derived(totals ? (projected ? totals.projected : totals.saved) : 0);
	const leadLabel = $derived(projected ? "Projected savings" : lead < 0 ? "Overspent" : "Saved");
	const tone = $derived(!totals || lead === 0 ? "none" : lead > 0 ? "good" : "bad");

	const share = (part: number, whole: number) =>
		whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;

	$effect(() => {
		const ours = root;
		if (!ours) {
			return;
		}
		return smoothRow(() => [...ours.querySelectorAll<HTMLElement>(":scope > .tr__card")]);
	});

	$effect(() => {
		void summaryState.versions[sheet];
		let stale = false;
		loadTrackingTotals(sheet)
			.then((t) => {
				if (!stale) {
					totals = t;
				}
				prefetchNeighbours(sheet, true);
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});
</script>

{#if totals}
	<div class="tr" bind:this={root}>
		<div class="tr__card tr__lead abt-card abt-stack" data-tone={tone}>
			<span class="tr__label abt-label">{leadLabel}</span>
			<RollingNumber
				value={lead}
				resetKey={sheet}
				class="tr__value tr__lead-value abt-num abt-privacy-number"
			/>
			<span class="tr__sub abt-cluster abt-gap-2">
				{#if projected}
					Saved so far <RollingNumber
						value={totals.saved}
						resetKey={sheet}
						class="abt-privacy-number"
					/>
				{:else}
					Planned <RollingNumber
						value={totals.projected}
						resetKey={sheet}
						class="abt-privacy-number"
					/>
				{/if}
			</span>
		</div>
		<div class="tr__card abt-card abt-stack">
			<span class="tr__label abt-label">Income</span>
			<RollingNumber
				value={totals.income}
				resetKey={sheet}
				class="tr__value abt-num abt-privacy-number"
			/>
			<span class="tr__sub abt-cluster abt-gap-2">
				{#if totals.incomeBudgeted > 0}
					<span class="tr__bar is-income"
						><i style:width="{share(totals.income, totals.incomeBudgeted)}%"></i></span
					>
					of {fmtMoney(totals.incomeBudgeted)}
				{:else}
					No income budgeted
				{/if}
			</span>
		</div>
		<div class="tr__card abt-card abt-stack">
			<span class="tr__label abt-label">Spent</span>
			<RollingNumber
				value={totals.spent}
				resetKey={sheet}
				class="tr__value abt-num abt-privacy-number"
			/>
			{#if totals.overIds.length}
				<span
					class="tr__sub abt-cluster abt-gap-2 is-bad"
					title="Categories spent past what's budgeted for them"
				>
					<i class="tr__dot"></i><RollingNumber
						value={totals.overspentNow}
						resetKey={sheet}
						class="abt-privacy-number"
					/>
					over · {totals.overIds.length}
					{totals.overIds.length === 1 ? "category" : "categories"}
				</span>
			{:else}
				<span class="tr__sub abt-cluster abt-gap-2">
					{#if totals.spentBudgeted > 0}
						<span class="tr__bar is-spent"
							><i style:width="{share(totals.spent, totals.spentBudgeted)}%"></i></span
						>
						of {fmtMoney(totals.spentBudgeted)}
					{:else}
						Nothing budgeted yet
					{/if}
				</span>
			{/if}
		</div>
		{#if totals.goals}
			<div
				class="tr__card tr__targets abt-card abt-stack"
				title="{totals.funded} of {totals.goals} targets funded"
			>
				<span class="tr__label abt-label">Targets funded</span>
				<span class="tr__targets-row abt-cluster">
					<span class="tr__bar tr__bar--wide is-targets"
						><i style:width="{(totals.funded / totals.goals) * 100}%"></i></span
					>
					<span class="tr__count abt-num"
						><RollingNumber value={totals.funded} format={String} resetKey={sheet} />/<RollingNumber
							value={totals.goals}
							format={String}
							resetKey={sheet}
						/></span
					>
				</span>
				<span class="tr__sub abt-cluster abt-gap-2">
					{#if totals.short.length}
						Needs <RollingNumber
							value={totals.short.reduce((t, c) => t + c.shortfall, 0)}
							resetKey={sheet}
							class="abt-privacy-number"
						/>
						{@const needs = totals.short.reduce((t, c) => t + c.shortfall, 0)}
						{#if totals.fromMoves >= needs}
							· from moving money
						{:else if totals.fromMoves > 0}
							· <span class="abt-privacy-number">{fmtMoney(totals.fromMoves)}</span> from moving money
						{/if}
					{:else}
						All targets met
					{/if}
				</span>
			</div>
		{/if}
	</div>
{:else}
	<!-- Laid out like the real row, so the cards replace it in place. -->
	<div class="tr" aria-hidden="true">
		{#each expectsTargets() ? ["tr__lead", "", "", "tr__targets"] : ["tr__lead", "", ""] as kind, i (i)}
			<div class="tr__card abt-card abt-stack is-skeleton {kind}">
				<span class="tr__label">&nbsp;</span>
				<span class="tr__value">&nbsp;</span>
				<span class="tr__sub">&nbsp;</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* The cards are items of Actual's month card, which lays out the row (see index.ts). */
	.tr {
		display: contents;
	}

	/* After the lead, beside the notes and menu Actual's header keeps in its corner. */
	.tr__card {
		order: 1;
		flex: 0 1 auto;
		/* The row's height in both modes (CARD_HEIGHT in index.ts), so switching never moves the table. */
		box-sizing: border-box;
		min-height: 92px;
		min-width: 160px;
		--abt-pad: var(--abt-space-3) var(--abt-space-5);
		justify-content: center;
	}

	/* The Targets card, whose bar can stretch or shrink, takes the row's slack. */
	.tr__targets {
		flex: 1 1 0;
		min-width: 150px;
	}

	/* Without targets, the Spent card takes it instead. */
	.tr:not(:has(> .tr__targets)) > .tr__card:last-child {
		flex-grow: 1;
	}

	/* Tinted by the month's result, glowing from its corner like envelope's To Budget card. */
	.tr__lead {
		order: 0;
		position: relative;
		min-width: 200px;
		--abt-card-tone: var(--abt-muted);
		border-color: transparent;
		background:
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--abt-card-tone) var(--abt-wash), transparent),
					transparent 70%
				)
				padding-box,
			linear-gradient(var(--abt-panel-surface), var(--abt-panel-surface)) padding-box,
			linear-gradient(
					var(--abt-glow-angle),
					color-mix(in srgb, var(--abt-card-tone) var(--abt-glow-strength), transparent),
					var(--abt-panel-border) var(--abt-glow-reach)
				)
				border-box,
			linear-gradient(var(--abt-panel-surface), var(--abt-panel-surface)) border-box;
		transition:
			--abt-glow-angle var(--abt-glow-duration) ease,
			--abt-glow-reach var(--abt-glow-duration) ease,
			--abt-glow-strength var(--abt-glow-duration) ease;
	}

	.tr__lead:hover {
		--abt-glow-angle: 225deg;
		--abt-glow-reach: 100%;
		--abt-glow-strength: 75%;
	}

	.tr__lead[data-tone="good"] {
		--abt-card-tone: var(--color-noticeTextLight);
	}

	.tr__lead[data-tone="bad"] {
		--abt-card-tone: var(--color-errorText);
	}

	.tr__lead[data-tone="good"] :global(.tr__lead-value) {
		color: var(--color-noticeTextLight);
	}

	.tr__lead[data-tone="bad"] :global(.tr__lead-value) {
		color: var(--color-errorText);
	}

	/* Fixed line heights keep every card, placeholders included, at the row's shared height. */
	.tr__label {
		line-height: 14px;
	}

	/* Rendered by RollingNumber, so outside this component's scope. */
	.tr :global(.tr__value) {
		line-height: 22px;
		font-size: var(--abt-text-xl);
		font-weight: 600;
		color: var(--color-pageText);
	}

	/* A plain line, not a flex row, so it can end in an ellipsis when the card is tight. */
	.tr .tr__sub {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		height: 16px;
		line-height: 16px;
		font-size: var(--abt-text-base);
		color: var(--color-pageTextSubdued);
		white-space: nowrap;
	}

	.tr__sub.is-bad {
		color: var(--color-errorText);
	}

	.tr__dot {
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: currentColor;
		display: inline-block;
		margin-right: var(--abt-space-2);
		vertical-align: 1px;
	}

	/* Inline in the sub line, ahead of "of …". */
	.tr__bar {
		display: inline-block;
		width: 48px;
		height: 6px;
		margin-right: var(--abt-space-2);
		border-radius: 3px;
		background: var(--abt-panel-track);
		overflow: hidden;
		vertical-align: 1px;
	}

	.tr__bar--wide {
		flex: 1;
		width: auto;
		min-width: 60px;
		margin: 0;
		vertical-align: baseline;
	}

	.tr__bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		/* Same easing and length as the rolling numbers, so the card moves as one. */
		transition: width 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.tr__bar.is-income i,
	.tr__bar.is-targets i {
		background: var(--color-noticeTextLight);
	}

	.tr__bar.is-spent i {
		background: var(--abt-accent);
	}

	.tr__targets-row {
		flex-wrap: nowrap;
		height: 22px;
	}

	.tr__count {
		font-size: var(--abt-text-base);
		font-weight: 600;
		color: var(--color-pageTextSubdued);
	}

	.tr__card.is-skeleton > span {
		width: 60%;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-panel-track);
	}

	.tr__card.is-skeleton > span + span {
		width: 80%;
	}

	@media (prefers-reduced-motion: reduce) {
		.tr__bar i {
			transition: none;
		}
	}
</style>
