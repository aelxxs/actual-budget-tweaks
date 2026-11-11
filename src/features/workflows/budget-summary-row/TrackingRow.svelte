<script lang="ts">
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { currentMonth } from "@lib/utilities/months";
	import ActionCard from "./ActionCard.svelte";
	import SlotCard from "./SlotCard.svelte";
	import { smoothRow } from "./smooth-row";
	import { summaryState } from "./state.svelte";
	import {
		cachedTrackingTotals,
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
	const hasStretch = $derived(
		summaryState.slots.cards.some((id) => ["targets", "pinned", "income"].includes(id)),
	);

	$effect(() => {
		const ours = root;
		if (!ours) {
			return;
		}
		return smoothRow(() => [
			...ours.querySelectorAll<HTMLElement>(":scope > .tr__card, :scope > .sr__card, :scope > .ac"),
		]);
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
	<div class="tr" class:has-flex={hasStretch} bind:this={root}>
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
		<SlotCard slot={0} {sheet} {totals} tracking />
		<SlotCard slot={1} {sheet} {totals} tracking />
		<ActionCard
			{sheet}
			toBudget={0}
			short={totals.short}
			overIds={totals.overIds}
			overspent={totals.overspentNow}
			toApply={totals.toApply}
			tracking
		/>
	</div>
{:else}
	<!-- Laid out like the real row, so the cards replace it in place. -->
	<div class="tr" aria-hidden="true">
		{#each ["tr__lead", "sr__card", "sr__card sr__flex", "is-action"] as kind, i (i)}
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

	.tr > :global(.sr__card) {
		order: 1;
		flex: 0 1 auto;
		box-sizing: border-box;
		min-height: 92px;
		min-width: 160px;
		--abt-pad: var(--abt-space-3) var(--abt-space-5);
		justify-content: center;
	}

	/* Cards with bars or rows can expand to use the space left by the lead and actions. */
	.tr > :global(.sr__flex) {
		flex: 1 1 0;
		min-width: 150px;
	}

	/* If neither selected card stretches, let the actions card use the remaining width. */
	.tr:not(.has-flex) > :global(.ac) {
		flex-grow: 1;
	}

	.tr > :global(.ac) {
		order: 1;
		flex: 0 1 auto;
		box-sizing: border-box;
		min-height: 92px;
		min-width: 210px;
		--abt-pad: var(--abt-space-3) var(--abt-space-5);
		justify-content: center;
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

	.tr__lead .tr__label {
		font-size: var(--abt-text-xs) !important;
		font-weight: 500 !important;
		letter-spacing: 0.04em !important;
		text-transform: uppercase !important;
		color: var(--color-tableHeaderText) !important;
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

	.tr__card.is-skeleton > span {
		width: 60%;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-panel-track);
	}

	.tr__card.is-skeleton > span + span {
		width: 80%;
	}

</style>
