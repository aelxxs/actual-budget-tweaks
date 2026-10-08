<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";

	type Props = {
		name: string;
		month: string;
		/** All amounts in cents. `spent` is positive. */
		budgeted: number;
		spent: number;
		balance: number;
		goalShortfall: number;
		/** Goal Funding is on, so the balance menu can fund the shortfall. */
		canFund: boolean;
		avgSpent: number | null;
		daysLeft: number | null;
	};

	const {
		name,
		month,
		budgeted,
		spent,
		balance,
		goalShortfall,
		canFund,
		avgSpent,
		daysLeft,
	}: Props = $props();

	const ratio = $derived(budgeted > 0 ? spent / budgeted : spent > 0 ? Infinity : 0);
	const fillPct = $derived(Math.min(100, Math.max(0, (Number.isFinite(ratio) ? ratio : 1) * 100)));
	const overspent = $derived(balance < 0);
	const overBudget = $derived(!overspent && ratio > 1);

	const fullySpent = $derived(budgeted > 0 && spent === budgeted);
	// "Running low" is only a live warning while the month is in progress
	// (daysLeft is null for past/future months); exact full spend is
	// completion (fixed bills), not a warning.
	const isCurrentMonth = $derived(daysLeft != null);

	const statusText = $derived.by(() => {
		if (overspent) {
			return `Overspent by ${fmtMoney(-balance)}`;
		}
		if (overBudget) {
			return "Over budget — covered by carryover";
		}
		if (fullySpent) {
			return "Budget fully spent";
		}
		if (budgeted <= 0 && spent <= 0) {
			return "No activity this month";
		}
		return `${Math.round(fillPct)}% of budget spent`;
	});

	const barState = $derived(
		overspent
			? "overspent"
			: overBudget
				? "over"
				: !fullySpent && isCurrentMonth && fillPct >= 85
					? "near"
					: "under",
	);

	const perDay = $derived(
		daysLeft && daysLeft > 0 && balance > 0 ? Math.floor(balance / daysLeft) : null,
	);
	const avgDelta = $derived(avgSpent != null && budgeted > 0 ? budgeted - avgSpent : null);
</script>

<div class="cp">
	<div class="cp__header">
		<span class="cp__name">{name}</span>
		<span class="cp__month">{month}</span>
	</div>

	<div class="cp__bar" data-state={barState}>
		<div class="cp__bar-fill" style="width: {fillPct}%"></div>
	</div>
	<div class="cp__status abt-privacy-number" data-state={barState}>{statusText}</div>

	<div class="cp__rows">
		<div class="cp__row">
			<span class="cp__label">Budgeted</span>
			<span class="cp__value abt-privacy-number">{fmtMoney(budgeted)}</span>
		</div>
		<div class="cp__row">
			<span class="cp__label">Spent</span>
			<span class="cp__value abt-privacy-number">{fmtMoney(spent)}</span>
		</div>
		<div class="cp__row">
			<span class="cp__label">Balance</span>
			<span class="cp__value abt-privacy-number" class:cp__value--neg={balance < 0}
				>{fmtMoney(balance)}</span
			>
		</div>
		{#if avgSpent != null}
			<div class="cp__row">
				<span class="cp__label">Avg spent (3 mo)</span>
				<span class="cp__value abt-privacy-number">
					{fmtMoney(avgSpent)}
					{#if avgDelta != null && Math.abs(avgDelta) >= 100}
						<span class="cp__hint" class:cp__hint--neg={avgDelta < 0}>
							{avgDelta < 0
								? `+${fmtMoney(-avgDelta)} vs budget`
								: `−${fmtMoney(avgDelta)} vs budget`}
						</span>
					{/if}
				</span>
			</div>
		{/if}
		{#if perDay != null}
			<div class="cp__row">
				<span class="cp__label">Left per day</span>
				<span class="cp__value abt-privacy-number">{fmtMoney(perDay)} × {daysLeft}d</span>
			</div>
		{/if}
	</div>

	<!-- Funding lives in the balance menu (Goal Funding); this only points there. -->
	{#if goalShortfall > 0}
		<div class="cp__goal-hint">
			<span class="abt-privacy-number">{fmtMoney(goalShortfall)}</span> short of goal{#if canFund}
				· click balance to fund{/if}
		</div>
	{/if}
</div>

<style>
	.cp {
		min-width: 240px;
		max-width: 320px;
		font-size: 12px;
		padding: 10px 12px;
	}

	.cp__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}

	.cp__name {
		font-weight: 600;
		font-size: 13px;
	}

	.cp__month {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		flex-shrink: 0;
	}

	.cp__bar {
		height: 6px;
		border-radius: 3px;
		background: var(--abt-ink-3);
		overflow: hidden;
	}

	.cp__bar-fill {
		height: 100%;
		border-radius: 3px;
		background: var(--color-noticeTextLight);
		transition: width 140ms ease;
	}

	.cp__bar[data-state="near"] .cp__bar-fill {
		background: var(--color-warningText);
	}

	.cp__bar[data-state="over"] .cp__bar-fill {
		background: var(--color-warningText);
	}

	.cp__bar[data-state="overspent"] .cp__bar-fill {
		background: var(--color-errorText);
	}

	.cp__status {
		margin-top: 4px;
		font-size: 11px;
		color: var(--color-pageTextSubdued);
	}

	.cp__status[data-state="overspent"] {
		color: var(--color-errorText);
	}

	.cp__status[data-state="over"] {
		color: var(--color-warningText);
	}

	.cp__rows {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--abt-ink-2);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cp__row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.cp__label {
		color: var(--color-pageTextSubdued);
	}

	.cp__value {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.cp__value--neg {
		color: var(--color-errorText);
	}

	.cp__hint {
		display: block;
		font-size: 10px;
		color: var(--color-noticeTextLight);
	}

	.cp__hint--neg {
		color: var(--color-warningText);
	}

	.cp__goal-hint {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--abt-ink-2);
		font-size: 11px;
		color: var(--color-warningText);
	}
</style>
