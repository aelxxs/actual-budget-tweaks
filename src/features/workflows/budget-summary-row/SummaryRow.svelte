<script lang="ts">
	import {
		BALANCE_CELL_RE,
		cellValue,
		fetchCells,
	} from "@features/readability/category-progress/cells";
	import { openInsights } from "@features/workflows/template-plan";
	import { templatePlanState } from "@features/workflows/template-plan/state.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney, loadCurrency } from "@lib/utilities/currency";
	import ActionCard from "./ActionCard.svelte";
	import type { Shortfall } from "./actions";
	import { summaryState } from "./state.svelte";

	const { sheet }: { sheet: string } = $props();

	interface Totals {
		toBudget: number;
		available: number;
		budgeted: number;
		overspent: number;
		nextMonth: number;
		spent: number;
		goals: number;
		funded: number;
		short: Shortfall[];
		/** This month's overspending, which comes out of next month's To Budget. */
		overspentNow: number;
		overIds: string[];
	}

	let totals = $state<Totals | null>(null);
	let root = $state<HTMLElement | null>(null);

	// Kept after hiding so the popover fades out in place instead of jumping to 0,0.
	let breakdownAt = $state({ top: 0, left: 0 });
	let breakdownOpen = $state(false);

	// Tints Actual's own To Budget card, which sits outside this component.
	$effect(() => {
		const card = root?.closest("[data-abt-summary-row]");
		if (!card || !totals) return;
		card.toggleAttribute("data-abt-to-budget-negative", totals.toBudget < 0);
		return () => card.removeAttribute("data-abt-to-budget-negative");
	});

	const toBudgetCard = $derived(root?.closest("[data-abt-summary-row]")?.lastElementChild ?? null);

	// The breakdown lives in Insights when it's on; the hover only stands in without it.
	// Its row clips overflow and slides with a transform, so the popover lives on <body>.
	$effect(() => {
		const anchor = toBudgetCard;
		if (!anchor || templatePlanState.enabled) return;
		const show = () => {
			const r = anchor.getBoundingClientRect();
			breakdownAt = { top: r.bottom + 6, left: r.left };
			breakdownOpen = true;
		};
		const hide = () => (breakdownOpen = false);
		anchor.addEventListener("mouseenter", show);
		anchor.addEventListener("mouseleave", hide);
		return () => {
			anchor.removeEventListener("mouseenter", show);
			anchor.removeEventListener("mouseleave", hide);
			hide();
		};
	});

	function portal(node: HTMLElement, target: Element = document.body) {
		target.appendChild(node);
		return { destroy: () => node.remove() };
	}

	const prevMonthName = $derived.by(() => {
		const y = Number(sheet.slice(6, 10));
		const m = Number(sheet.slice(10, 12));
		return new Date(y, m - 2, 1).toLocaleString(undefined, { month: "short" });
	});

	/** The categories this month's table shows, from its balance cells. */
	function categoryIds(): string[] {
		const ids = new Set<string>();
		for (const el of document.querySelectorAll(`[data-cellname^="${sheet}!leftover-"]`)) {
			const match = el.getAttribute("data-cellname")?.match(BALANCE_CELL_RE);
			if (match) ids.add(match[2]);
		}
		return [...ids];
	}

	async function load(force: boolean): Promise<Totals> {
		await loadCurrency();
		const [toBudget, available, budgeted, overspent, nextMonth, spent] = await Promise.all(
			[
				"to-budget",
				"available-funds",
				"total-budgeted",
				"last-month-overspent",
				"buffered-selected",
				"total-spent",
			].map((name) => cellValue(sheet, name)),
		);
		const ids = categoryIds();
		const cats = (await Promise.all(ids.map((id) => fetchCells(sheet, id, force)))).map(
			(cells, i) => ({ ...cells, id: ids[i] }),
		);
		const withGoal = cats.filter((c) => c.hasGoal);
		const over = cats.filter((c) => c.balance < 0);
		// Actual stores these as negative outflows.
		return {
			toBudget,
			available,
			budgeted: Math.abs(budgeted),
			overspent: Math.abs(overspent),
			nextMonth: Math.abs(nextMonth),
			spent: Math.abs(spent),
			goals: withGoal.length,
			funded: withGoal.filter((c) => c.goalShortfall === 0).length,
			short: withGoal
				.filter((c) => c.goalShortfall > 0)
				.map((c) => ({ id: c.id, shortfall: c.goalShortfall })),
			overspentNow: over.reduce((sum, c) => sum - c.balance, 0),
			overIds: over.map((c) => c.id),
		};
	}

	$effect(() => {
		const force = summaryState.version > 0;
		let stale = false;
		load(force)
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
	<div class="sr" bind:this={root}>
		{#if templatePlanState.enabled && toBudgetCard}
			<button
				type="button"
				class="sr__more"
				data-abt-summary-more
				title="Month breakdown in Insights"
				aria-label="Month breakdown in Insights"
				use:portal={toBudgetCard}
				onclick={() => openInsights("overview")}
			>
				<Icon name="layout" size={13} />
			</button>
		{:else}
			<div
				class="sr__breakdown"
				class:is-open={breakdownOpen}
				role="tooltip"
				use:portal
				style:top="{breakdownAt.top}px"
				style:left="{breakdownAt.left}px"
			>
				<div class="sr__line">
					<span>Available funds</span><span class="abt-privacy-number"
						>{fmtMoney(totals.available)}</span
					>
				</div>
				{#if totals.overspent}
					<div class="sr__line is-bad">
						<span>Overspent in {prevMonthName}</span><span class="abt-privacy-number"
							>−{fmtMoney(totals.overspent)}</span
						>
					</div>
				{/if}
				<div class="sr__line">
					<span>Budgeted</span><span class="abt-privacy-number">−{fmtMoney(totals.budgeted)}</span>
				</div>
				{#if totals.nextMonth}
					<div class="sr__line">
						<span>For next month</span><span class="abt-privacy-number"
							>−{fmtMoney(totals.nextMonth)}</span
						>
					</div>
				{/if}
				<div class="sr__line is-total">
					<span>To Budget</span><span class="abt-privacy-number">{fmtMoney(totals.toBudget)}</span>
				</div>
			</div>
		{/if}
		<div class="sr__card">
			<span class="sr__label">Spent</span>
			<span class="sr__value abt-privacy-number">{fmtMoney(totals.spent)}</span>
			{#if totals.overIds.length}
				<span
					class="sr__sub is-bad"
					title="Overspending comes out of next month's To Budget unless you cover it"
				>
					<i class="sr__dot"></i><span class="abt-privacy-number"
						>{fmtMoney(totals.overspentNow)}</span
					>
					overspent · {totals.overIds.length}
					{totals.overIds.length === 1 ? "category" : "categories"}
				</span>
			{:else}
				<span class="sr__sub">
					{#if totals.budgeted > 0}
						of <span class="abt-privacy-number">{fmtMoney(totals.budgeted)}</span> budgeted
					{:else}
						Nothing budgeted yet
					{/if}
				</span>
			{/if}
		</div>
		{#if totals.goals}
			<div class="sr__card sr__targets" title="{totals.funded} of {totals.goals} targets funded">
				<span class="sr__label">Targets funded</span>
				<span class="sr__targets-row">
					<span class="sr__bar"><i style:width="{(totals.funded / totals.goals) * 100}%"></i></span>
					<span class="sr__count">{totals.funded}/{totals.goals}</span>
				</span>
				<span class="sr__sub">
					{#if totals.short.length}
						Needs <span class="abt-privacy-number"
							>{fmtMoney(totals.short.reduce((t, c) => t + c.shortfall, 0))}</span
						>
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
			<div class="sr__card is-skeleton">
				<span class="sr__label">&nbsp;</span>
				<span class="sr__value">&nbsp;</span>
				<span class="sr__sub">&nbsp;</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* The cards are laid out by Actual's month card, which this row lives inside. */
	.sr {
		display: contents;
	}

	/* Fixed line heights keep every card, placeholders included, the same height. */
	.sr__card {
		order: 1;
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		/* Never narrower than the figures; the row wraps instead of clipping them. */
		min-width: max-content;
		padding: 10px 14px;
		border: 1px solid var(--abt-panel-border);
		border-radius: var(--abt-radius);
		background: var(--abt-panel-surface);
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

	.sr__label {
		line-height: 14px;
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-tableHeaderText);
		white-space: nowrap;
	}

	.sr__value {
		line-height: 20px;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-pageText);
		white-space: nowrap;
	}

	.sr__more {
		position: absolute;
		top: 6px;
		right: 6px;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: var(--abt-radius);
		background: none;
		color: var(--color-tableHeaderText);
		cursor: pointer;
	}

	.sr__more:hover {
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
		color: var(--color-pageText);
	}

	.sr__breakdown {
		position: fixed;
		z-index: 10000;
		width: 260px;
		padding: 8px 12px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
		opacity: 0;
		pointer-events: none;
		transform: translateY(-4px);
		transition:
			opacity 0.12s,
			transform 0.12s;
	}

	.sr__breakdown.is-open {
		opacity: 1;
		transform: none;
	}

	.sr__line {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 3px 0;
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
		color: var(--color-pageTextSubdued);
	}

	.sr__line.is-bad span:last-child {
		color: var(--color-errorText);
	}

	.sr__line.is-total {
		margin-top: 4px;
		padding-top: 7px;
		border-top: 1px solid var(--color-tableBorder);
		font-weight: 600;
		color: var(--color-pageText);
	}

	.sr__sub {
		line-height: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		gap: 5px;
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
	}

	.sr__targets {
		flex: 1 1 140px;
	}

	.sr__targets-row {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 20px;
	}

	.sr__count {
		font-size: 12.5px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-pageTextSubdued);
		white-space: nowrap;
	}

	.sr__bar {
		display: block;
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
	}
</style>
