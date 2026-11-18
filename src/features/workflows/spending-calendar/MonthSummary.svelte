<script lang="ts">
	import { fmtMoney } from "@lib/format/currency";
	import type { MonthSummary } from "./summary";

	const { summary, stale }: { summary: MonthSummary; stale: boolean } = $props();
</script>

<dl class="summary" class:is-stale={stale}>
	<div>
		<dt>Spent</dt>
		<dd class="abt-privacy-number">{fmtMoney(summary.spent)}</dd>
	</div>
	<div>
		<dt>Income</dt>
		<dd class="abt-privacy-number" class:is-pos={summary.income > 0}>
			{fmtMoney(summary.income)}
		</dd>
	</div>
	<div>
		<dt>Net</dt>
		<dd class="abt-privacy-number" class:is-pos={summary.net > 0} class:is-neg={summary.net < 0}>
			{fmtMoney(summary.net, { sign: true })}
		</dd>
	</div>
	{#if summary.hasUpcoming}
		<div class="is-upcoming">
			<dt>Upcoming</dt>
			<dd class="abt-privacy-number">{fmtMoney(summary.upcoming, { sign: true })}</dd>
		</div>
	{/if}
</dl>

<style>
	.summary {
		display: flex;
		gap: 20px;
		margin: 0;
		transition: opacity 0.15s;
	}
	.summary.is-stale {
		opacity: 0.5;
	}
	.summary > div {
		display: flex;
		flex-direction: column;
		gap: 3px; /* raw: between the 2px and 4px steps */
	}
	dt {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	dd {
		margin: 0;
		font-size: var(--abt-text-md);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	dd.is-pos {
		color: var(--color-noticeTextLight);
	}
	dd.is-neg {
		color: var(--color-errorText);
	}
	.is-upcoming dd {
		color: var(--abt-muted);
	}

	/* Queries the calendar page's container. */
	@container (max-width: 820px) {
		.is-upcoming {
			display: none;
		}
	}
	@container (max-width: 680px) {
		.summary {
			display: none;
		}
	}
</style>
