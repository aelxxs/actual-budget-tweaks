<script lang="ts">
	import { balanceColors, followBalanceColors } from "../lib/balance-colors.svelte";

	followBalanceColors();
	import { fmtMoney } from "@lib/format/currency";
	import { createLogger } from "@lib/logger";
	import { ArrowRight } from "@lucide/svelte";
	import { portal } from "../actions/portal";
	import type { AccountDetail } from "../lib/account-detail";
	import { loadAccountDetail } from "../lib/account-detail";
	import type { SidebarAccount } from "../lib/data";
	import StatusIcon from "./StatusIcon.svelte";
	import { reviewState } from "@features/workflows/sync-recap/queue-state.svelte";

	const {
		account,
		top,
		left,
		flip,
		onEnter,
		onLeave,
		onReview,
		onReviewNew,
	}: {
		account: SidebarAccount;
		/** Level with the row; moved up as far as the card needs to stay on screen. */
		top: number;
		left: number;
		flip: boolean;
		onEnter: () => void;
		onLeave: () => void;
		onReview: () => void;
		/** Opens Sync recap on this account's newly imported transactions. */
		onReviewNew: () => void;
	} = $props();

	// Imported by a sync and not yet marked reviewed (Sync recap); 0 while that's off.
	const toReview = $derived(reviewState.byAccount[account.id] ?? 0);

	const log = createLogger("sidebar");

	// Loaded on first hover and kept per account (see account-detail.ts).
	let detail = $state<AccountDetail | null>(null);
	let height = $state(0);
	const EDGE = 12;
	const shownTop = $derived(Math.max(EDGE, Math.min(top, innerHeight - height - EDGE)));

	$effect(() => {
		let cancelled = false;
		detail = null;
		loadAccountDetail(account.id, account.status, account.balance).then(
			(d) => {
				if (!cancelled) {
					detail = d;
				}
			},
			(err) => log.warn("Couldn't load the account card:", err),
		);
		return () => {
			cancelled = true;
		};
	});

	// Owing less reads better than a signed change on a debt.
	function trendText(balance: number, delta: number): string {
		if (delta === 0) {
			return "No change";
		}
		if (balance < 0) {
			return `Owed ${fmtMoney(Math.abs(delta))} ${delta > 0 ? "less" : "more"}`;
		}
		return fmtMoney(delta, { sign: true });
	}

	function trendPath(pts: number[], w: number, h: number, pad = 3) {
		const min = Math.min(...pts);
		const max = Math.max(...pts);
		const range = max - min || 1;
		const step = w / (pts.length - 1);
		const xy = pts.map(
			(p, i) => [i * step, pad + (h - pad * 2) * (1 - (p - min) / range)] as const,
		);
		const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
		return { line, area: `${line} L ${w} ${h} L 0 ${h} Z` };
	}
</script>

{#if detail}
	{@const d = detail}
	{@const overdue = d.upcoming.filter((u) => u.overdue)}
	{@const ahead = d.upcoming.filter((u) => !u.overdue).slice(0, 3)}
	<div
		use:portal
		class="acard abt-popover"
		class:flip
		style:top="{shownTop}px"
		style:left="{left}px"
		bind:offsetHeight={height}
		onpointerenter={onEnter}
		onpointerleave={onLeave}
		role="tooltip"
	>
		<div class="head">
			<span class="status"><StatusIcon status={account.status} /></span>
			<div class="title">
				<span class="name">{account.name}</span>
				<span class="sub">
					{d.institution}{#if d.syncText}
						· <span class:warn={account.status === "error"}>{d.syncText}</span>{/if}
				</span>
			</div>
		</div>

		<div class="balance">
			<span class="abt-label">Balance</span>
			<span
				class="amount big abt-privacy-number"
				class:neg={balanceColors.on && account.balance < 0}>{fmtMoney(account.balance)}</span
			>
		</div>

		{#if d.hasActivity}
			{@const path = trendPath(d.points, 264, 44)}
			<div class="chart">
				<svg viewBox="0 0 264 44" preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<linearGradient id="acardgrad-{account.id}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="currentColor" stop-opacity="0.22" />
							<stop offset="100%" stop-color="currentColor" stop-opacity="0" />
						</linearGradient>
					</defs>
					<path d={path.area} fill="url(#acardgrad-{account.id})" stroke="none" />
					<path
						d={path.line}
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		{/if}
		<div class="line quiet">
			<span>30 days</span>
			{#if d.hasActivity}
				<span class="abt-privacy-number">{trendText(account.balance, d.deltaAbs)}</span>
			{:else}
				<span>No activity</span>
			{/if}
		</div>

		{#if d.unclearedAmount !== 0 || account.uncategorized > 0 || toReview > 0}
			<div class="divider"></div>
			{#if toReview > 0}
				<div class="line">
					<span>{toReview} new to review</span>
					<button type="button" class="review" onclick={onReviewNew}>
						Review <ArrowRight size={12} strokeWidth={2} />
					</button>
				</div>
			{/if}
			{#if account.uncategorized > 0}
				<div class="line">
					<span>{account.uncategorized} uncategorized</span>
					<button type="button" class="review" onclick={onReview}>
						Review <ArrowRight size={12} strokeWidth={2} />
					</button>
				</div>
			{/if}
			{#if d.unclearedAmount !== 0}
				<div class="line">
					<span>Uncleared</span>
					<span class="amount abt-privacy-number"
						>{fmtMoney(d.unclearedAmount, { sign: true })}</span
					>
				</div>
			{/if}
		{/if}

		{#if overdue.length || ahead.length}
			<div class="divider"></div>
			{#if overdue.length}
				<span class="abt-label group warn">Overdue</span>
				{#each overdue as u (u.id)}
					<div class="sched">
						<span class="date">{u.date}</span>
						<span class="payee">{u.payee}</span>
						<span class="amount warn abt-privacy-number">{fmtMoney(u.amount, { sign: true })}</span>
					</div>
				{/each}
			{/if}
			{#if ahead.length}
				<span class="abt-label group">Upcoming</span>
				{#each ahead as u (u.id)}
					<div class="sched">
						<span class="date">{u.date}</span>
						<span class="payee">{u.payee}</span>
						<span class="amount abt-privacy-number">{fmtMoney(u.amount, { sign: true })}</span>
					</div>
				{/each}
			{/if}
		{/if}
	</div>
{/if}

<style>
	.acard {
		position: fixed;
		/* In the body-level portal, above Actual's own stacking contexts. */
		z-index: 9999997;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		width: 292px;
		box-sizing: border-box;
		padding: var(--abt-space-4);
		font-size: var(--abt-text-base);
		animation: acard-in 0.13s ease;
	}
	@keyframes acard-in {
		from {
			opacity: 0;
			transform: translateX(-4px);
		}
	}
	.acard.flip {
		animation-name: acard-in-flip;
	}
	@keyframes acard-in-flip {
		from {
			opacity: 0;
			transform: translateX(4px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.acard {
			animation: none;
		}
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.status {
		display: flex;
		flex-shrink: 0;
	}
	.status :global(.status) {
		width: 15px;
		height: 15px;
	}
	.title {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-size: var(--abt-text-md);
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.sub {
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
	}

	.balance {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: var(--abt-space-2);
	}
	.amount {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.amount.big {
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}
	.amount.neg {
		color: var(--sb-danger, var(--color-errorText));
	}

	.chart {
		color: var(--abt-accent);
	}
	.chart svg {
		display: block;
		width: 100%;
		height: 44px;
	}
	/* The line's shape gives away the amounts the privacy blur hides. */
	:global(body.abt-privacy-enabled) .chart {
		display: none;
	}

	.line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
	}
	.line.quiet {
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
	}

	.divider {
		height: 1px;
		margin: var(--abt-space-1) 0;
		background: var(--abt-line);
	}

	.review {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-1);
		padding: var(--abt-space-1) var(--abt-space-2);
		margin-right: calc(-1 * var(--abt-space-2));
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-accent);
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}
	.review:hover {
		background: var(--abt-accent-1);
	}

	.group {
		margin-top: var(--abt-space-1);
	}
	.sched {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.date {
		flex-shrink: 0;
		width: 44px;
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
		font-variant-numeric: tabular-nums;
	}
	.payee {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	/* Only the heading and the amount: a whole row in the warning colour was too loud. */
	.warn {
		color: var(--color-warningText);
	}
</style>
