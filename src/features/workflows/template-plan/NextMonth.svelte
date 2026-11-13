<script lang="ts">
	import Section from "@lib/components/panel/Section.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney } from "@lib/format/currency";
	import { runway } from "./overview";

	let {
		monthKey,
		held,
		need,
		projected = false,
		emptyText,
		later = [],
		loading = false,
	}: {
		monthKey: string;
		held: number;
		/** What next month costs in full; null or 0 when it can't be worked out. */
		need: number | null;
		/** A month before this one isn't budgeted yet, so its balances are only a projection. */
		projected?: boolean;
		emptyText: string;
		/** What each month after next needs, as far as the held money could reach. */
		later?: number[];
		/** The months ahead are still being worked out. */
		loading?: boolean;
	} = $props();

	/** Months shown in the strip; a longer runway is summed up beside the headline. */
	const SHOWN = 6;

	const monthName = (key: string, style: "long" | "short", year = false) => {
		const [y, m] = key.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
			month: style,
			year: year ? "numeric" : undefined,
		});
	};

	const plan = $derived(need === null ? null : runway(monthKey, held, [need, ...later], SHOWN));
	const months = $derived(plan?.months ?? []);
	const lastCovered = $derived(plan?.lastCovered ?? -1);
	const covered = $derived(lastCovered >= 0);
	const beyond = $derived(lastCovered - (SHOWN - 1));
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
		<div class="strip" aria-hidden="true">
			{#each { length: SHOWN } as _, i (i)}
				<div class="slot"><span class="bar"></span><span class="label">&nbsp;</span></div>
			{/each}
		</div>
		<div class="ends">
			<span class="abt-skeleton" style:width="60%" style:height="10px"></span>
		</div>
	{:else if !need || need <= 0}
		<div class="abt-tab-overview-empty-row">{emptyText}</div>
	{:else}
		<div class="answer" data-state={covered ? "covered" : "short"}>
			<Icon name={covered ? "checkCircle" : "calendar"} size={18} />
			<span class="headline">
				{#if lastCovered > 0}
					Covered through {monthName(months[lastCovered].key, "short", true)}
				{:else if covered}
					{monthName(monthKey, "long")} is covered
				{:else}
					{monthName(monthKey, "long")} is {pct}% funded
				{/if}
			</span>
			{#if beyond > 0}
				<span class="beyond">+{beyond} → {monthName(months[lastCovered].key, "short")}</span>
			{/if}
		</div>
		<div class="strip" data-state={covered ? "covered" : "short"}>
			{#each months.slice(0, SHOWN) as slot, i (slot.key)}
				<div class="slot" class:next={i === 0}>
					<span class="bar"><span class="fill" style:width="{slot.fill * 100}%"></span></span>
					<span class="label">{monthName(slot.key, "short")}</span>
				</div>
			{/each}
		</div>
		<div class="ends">
			{#if covered}
				<span class="abt-privacy-number">{fmtMoney(held)}</span> held ·
				<span class="abt-privacy-number">{fmtMoney(need)}</span> for {monthName(monthKey, "short")}
			{:else}
				<span class="abt-privacy-number">{fmtMoney(Math.max(0, held))}</span> of
				<span class="abt-privacy-number">{fmtMoney(need)}</span> for {monthName(monthKey, "short")}
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
	.answer[data-state="covered"] {
		color: var(--color-budgetNumberPositive);
	}

	.headline {
		flex: 1;
		min-width: 0;
		color: var(--abt-ink);
		font-size: var(--abt-text-lg);
		font-weight: 700;
	}

	.beyond {
		flex: none;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
		font-variant-numeric: tabular-nums;
	}

	.strip {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--abt-space-2);
		margin: 10px 0 8px;
		--fill: var(--color-warningText);
	}
	.strip[data-state="covered"] {
		--fill: var(--color-budgetNumberPositive);
	}

	.slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--abt-space-2);
		min-width: 0;
	}

	.bar {
		width: 100%;
		height: 6px;
		overflow: hidden;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-panel-track);
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--fill);
		transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.label {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		padding-bottom: 1px;
	}
	.next .label {
		color: var(--abt-ink);
		box-shadow: inset 0 -1px 0 currentColor;
	}

	.ends {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		font-variant-numeric: tabular-nums;
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
