<script lang="ts">
	import { fmtMoney } from "@lib/format/currency";
	import type { Payoff } from "./amortize";
	import { monthName, span } from "./format";
	import { openPanel } from "./panel";

	const { accountId, payoff }: { accountId: string; payoff: Payoff } = $props();
</script>

<button
	type="button"
	class="ls"
	title="On the saved rate and payment. Open the payoff plan."
	onclick={() => openPanel(accountId)}
>
	<span class="ls__label">Paid off</span>
	<span class="ls__value">{monthName(payoff.month)}</span>
	<span class="ls__meta">
		in {span(payoff.payments)} ·
		<span class="abt-privacy-number">{fmtMoney(payoff.interest)}</span> interest
	</span>
</button>

<style>
	/* Sits in Actual's balance row, so it reads as one of the balance's details rather than a button. */
	.ls {
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-2);
		margin-left: var(--abt-space-4);
		padding: var(--abt-space-1) var(--abt-space-3);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-pill);
		background: none;
		color: var(--abt-ink);
		font: inherit;
		font-size: var(--abt-text-sm);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.1s,
			border-color 0.1s;
	}

	.ls:hover {
		border-color: var(--abt-accent-4);
		background: var(--abt-accent-1);
	}

	.ls__label,
	.ls__meta {
		color: var(--abt-muted);
	}

	.ls__value {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
