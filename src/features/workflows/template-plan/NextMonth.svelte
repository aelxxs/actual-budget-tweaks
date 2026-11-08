<script lang="ts">
	import Section from "@lib/components/panel/Section.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { addMonths } from "@lib/utilities/months";

	let {
		monthKey,
		held,
		need,
		needLabel,
		projected = false,
		emptyText,
		later = [],
		loading = false,
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
		/** What each month after next needs, as far as the held money could reach. */
		later?: number[];
		/** The months ahead are still being worked out. */
		loading?: boolean;
	} = $props();

	interface Ahead {
		key: string;
		need: number;
		covered: boolean;
		/** What's missing, for the first month the money runs out in. */
		short: number;
	}

	let open = $state(false);

	const monthName = (key: string, year = true) => {
		const [y, m] = key.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
			month: "long",
			year: year ? "numeric" : undefined,
		});
	};

	/** Spends what's held month by month from next month, until it runs out or the needs do. */
	const ahead = $derived.by((): Ahead[] => {
		if (need === null || need <= 0) {
			return [];
		}
		const rows: Ahead[] = [{ key: monthKey, need, covered: held >= need, short: 0 }];
		let left = held - need;
		for (const [i, n] of later.entries()) {
			if (left <= 0 || n <= 0) {
				break;
			}
			rows.push({
				key: addMonths(monthKey, i + 1),
				need: n,
				covered: left >= n,
				short: Math.max(0, n - left),
			});
			left -= n;
		}
		return rows;
	});
	const lastCovered = $derived(ahead.findLast((r) => r.covered) ?? null);

	// Another month starts closed.
	$effect.pre(() => {
		void monthKey;
		open = false;
	});

	const name = $derived.by(() => {
		const [y, m] = monthKey.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long" });
	});
	const covered = $derived(need !== null && held >= need);
	const pct = $derived(need && need > 0 ? Math.round((Math.max(0, held) / need) * 100) : 0);
</script>

<Section title="Next Month">
	{#if loading}
		<!-- Shaped like the answer below, so it arrives without a jump. -->
		<div class="answer" aria-busy="true" aria-label="Working out the months ahead">
			<span
				class="abt-skeleton"
				style:width="18px"
				style:height="18px"
				style:border-radius="var(--abt-radius-pill)"
			></span>
			<span class="abt-skeleton" style:width="60%" style:height="16px"></span>
		</div>
		<div class="track"></div>
		<div class="ends">
			<span class="abt-skeleton" style:width="96px" style:height="10px"></span>
			<span class="abt-skeleton" style:width="72px" style:height="10px"></span>
		</div>
	{:else if !need || need <= 0}
		<div class="abt-tab-overview-empty-row">{emptyText}</div>
	{:else}
		<div class="answer" data-ready={covered}>
			<Icon name={covered ? "checkCircle" : "calendar"} size={18} />
			<span class="text">
				<span class="headline">
					{#if covered && lastCovered && lastCovered.key !== monthKey}
						Covered through {monthName(
							lastCovered.key,
							lastCovered.key.slice(0, 4) !== monthKey.slice(0, 4),
						)}
					{:else if covered}
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
		{#if covered && ahead.length > 1}
			<button
				type="button"
				class="ahead-toggle"
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				<span>Months ahead</span>
				<Icon name="chevronDown" size={14} />
			</button>
			{#if open}
				<ul class="ahead">
					{#each ahead as row (row.key)}
						<li data-covered={row.covered}>
							<Icon name={row.covered ? "checkCircle" : "calendar"} size={13} />
							<span class="ahead-month">{monthName(row.key)}</span>
							<span class="ahead-value abt-privacy-number">
								{#if row.covered}
									{fmtMoney(row.need)}
								{:else}
									{fmtMoney(row.short)} short
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{/if}
</Section>

<style>
	/* Short of next month is the normal state mid-month, so it reads as progress, not a warning. */
	.answer {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--abt-muted);
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
		background: var(--abt-accent);
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

	.ahead-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		margin-top: var(--abt-space-3);
		/* The card's own bottom padding, so the label sits midway between the divider and the edge. */
		padding: 10px 0 0; /* raw: Section's card padding */
		border: 0;
		border-top: 1px solid var(--abt-ink-2);
		background: none;
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-sm);
		font-weight: 550;
		cursor: pointer;
	}
	.ahead-toggle:hover {
		color: var(--abt-ink);
	}
	.ahead-toggle :global(svg) {
		transition: transform 0.15s ease;
	}
	.ahead-toggle[aria-expanded="true"] :global(svg) {
		transform: rotate(180deg);
	}

	.ahead {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		margin: var(--abt-space-2) 0 0;
		padding: 0;
		list-style: none;
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
	}
	.ahead li {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-1) 0;
	}
	.ahead li :global(svg) {
		flex: none;
		color: var(--color-budgetNumberPositive);
	}
	.ahead li[data-covered="false"] :global(svg),
	.ahead li[data-covered="false"] .ahead-value {
		color: var(--abt-muted);
	}
	.ahead-month {
		flex: 1;
		min-width: 0;
		color: var(--abt-ink);
	}
	.ahead-value {
		color: var(--abt-muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.fill {
			transition: none;
		}
	}
</style>
