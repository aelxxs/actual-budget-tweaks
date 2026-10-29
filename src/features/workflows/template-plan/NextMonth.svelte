<script lang="ts">
	import Section from "@lib/components/panel/Section.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney } from "@lib/utilities/currency";

	let {
		monthKey,
		held,
		need,
		needLabel,
		projected = false,
		emptyText,
	}: {
		monthKey: string;
		held: number;
		/** What next month costs in full; null or 0 when it can't be worked out. */
		need: number | null;
		/** Says what `need` is based on, e.g. "for its goals". */
		needLabel: string;
		/** A month before this one isn't budgeted yet, so its balances are only a projection. */
		projected?: boolean;
		emptyText: string;
	} = $props();

	const name = $derived.by(() => {
		const [y, m] = monthKey.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long" });
	});
	const covered = $derived(need !== null && held >= need);
	const pct = $derived(need && need > 0 ? Math.round((Math.max(0, held) / need) * 100) : 0);
</script>

<Section title="Next Month">
	{#if !need || need <= 0}
		<div class="abt-tab-overview-empty-row">{emptyText}</div>
	{:else}
		<div class="answer" data-ready={covered}>
			<Icon name={covered ? "checkCircle" : "alert"} size={18} />
			<span class="text">
				<span class="headline">
					{#if covered}
						{name} is covered
					{:else}
						{name} needs <span class="abt-privacy-number">{fmtMoney(need - held)}</span> more
					{/if}
				</span>
			</span>
			{#if !covered}
				<span class="pct">{pct}%</span>
			{/if}
		</div>
		<!-- Covered: held money split into needed and spare. Short: the need split into held and missing. -->
		<div class="track" data-ready={covered} aria-hidden="true">
			<span class="fill" style:width="{covered ? (need / held) * 100 : Math.min(100, pct)}%"></span>
		</div>
		<div class="ends">
			{#if covered}
				<span><span class="abt-privacy-number">{fmtMoney(need)}</span> {needLabel}</span>
				{#if held > need}
					<span><span class="abt-privacy-number">{fmtMoney(held - need)}</span> spare</span>
				{/if}
			{:else}
				<span><span class="abt-privacy-number">{fmtMoney(Math.max(0, held))}</span> held</span>
				<span><span class="abt-privacy-number">{fmtMoney(need - held)}</span> short</span>
			{/if}
		</div>
		{#if projected}
			<p class="sub">Projected: a month before isn't budgeted yet.</p>
		{/if}
	{/if}
</Section>

<style>
	.answer {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-warningText);
	}
	.answer[data-ready="true"] {
		color: var(--color-budgetNumberPositive);
	}

	.text {
		flex: 1;
		min-width: 0;
		color: var(--abt-ink);
	}

	.pct {
		font-size: var(--abt-text-lg);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.track {
		height: 6px;
		margin: 10px 0 6px;
		overflow: hidden;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-panel-track);
	}
	.track[data-ready="true"] {
		background: color-mix(in srgb, var(--color-budgetNumberPositive) 30%, transparent);
	}

	.fill {
		display: block;
		height: 100%;
		min-width: 2px;
		border-radius: inherit;
		background: var(--color-warningText);
		transition: width 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.track[data-ready="true"] .fill {
		background: var(--color-budgetNumberPositive);
	}

	.ends {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		font-variant-numeric: tabular-nums;
	}

	.headline {
		font-size: var(--abt-text-lg);
		font-weight: 700;
	}

	.sub {
		margin: 6px 0 0;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		.fill {
			transition: none;
		}
	}
</style>
