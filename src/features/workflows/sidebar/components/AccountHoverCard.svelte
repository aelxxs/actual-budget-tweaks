<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";
	import { portal } from "../actions/portal";
	import type { AccountDetail } from "../lib/account-detail";
	import { loadAccountDetail } from "../lib/account-detail";
	import type { SidebarAccount } from "../lib/data";
	import StatusIcon from "./StatusIcon.svelte";

	const {
		account,
		top,
		left,
		flip,
	}: {
		account: SidebarAccount;
		top: number;
		left: number;
		flip: boolean;
	} = $props();

	// Lazily loaded and cached by id on first hover (see account-detail.ts).
	let detail = $state<AccountDetail | null>(null);

	$effect(() => {
		let cancelled = false;
		detail = null;
		loadAccountDetail(account.id, account.status, account.balance).then((d) => {
			if (!cancelled) detail = d;
		});
		return () => {
			cancelled = true;
		};
	});

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
	{@const up = d.deltaAbs >= 0}
	{@const path = trendPath(d.points, 264, 52)}
	<div use:portal class="acard" class:flip style="top: {top}px; left: {left}px">
		<div class="acard-head">
			<span class="acard-status"><StatusIcon status={account.status} /></span>
			<div class="acard-title">
				<span class="acard-name">{account.name}</span>
				<span class="acard-sub">{d.institution} · {d.type}</span>
			</div>
		</div>

		<div class="acard-balrow">
			<span class="acard-ballabel">Balance</span>
			<span class="acard-bal abt-privacy-number" class:neg={account.balance < 0}
				>{fmtMoney(account.balance)}</span
			>
		</div>

		<div class="acard-chart">
			<svg viewBox="0 0 264 52" preserveAspectRatio="none" class:up class:down={!up}>
				<defs>
					<linearGradient id="acardgrad-{account.id}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
						<stop offset="100%" stop-color="currentColor" stop-opacity="0" />
					</linearGradient>
				</defs>
				<path d={path.area} fill="url(#acardgrad-{account.id})" stroke="none" />
				<path
					d={path.line}
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			</svg>
			<div class="acard-chart-foot">
				<span class="acard-period">30 days</span>
				<span class="acard-delta" class:up class:down={!up}>
					{up ? "▲" : "▼"}
					{Math.abs(d.deltaPct).toFixed(1)}%
					<span class="acard-delta-abs abt-privacy-number"
						>{fmtMoney(d.deltaAbs, { sign: true })}</span
					>
				</span>
			</div>
		</div>

		<div class="acard-div"></div>
		<div class="acard-lines">
			<div class="acard-line">
				<span class="k">Cleared</span>
				<span class="v abt-privacy-number">{fmtMoney(d.clearedBalance)}</span>
			</div>
			{#if d.unclearedCount}
				<div class="acard-line">
					<span class="k">Uncleared <span class="acard-badge">{d.unclearedCount}</span></span>
					<span class="v abt-privacy-number" class:neg={d.unclearedAmount < 0}
						>{fmtMoney(d.unclearedAmount, { sign: true })}</span
					>
				</div>
			{/if}
		</div>

		{#if d.upcoming.length}
			<div class="acard-div"></div>
			<div class="acard-block-label">Upcoming</div>
			<div class="acard-lines">
				{#each d.upcoming as u (u.id)}
					<div class="acard-sched">
						<span class="acard-date">{u.date}</span>
						<span class="acard-payee">{u.payee}</span>
						<span class="acard-amt abt-privacy-number" class:neg={u.amount < 0}
							>{fmtMoney(u.amount, { sign: true })}</span
						>
					</div>
				{/each}
			</div>
		{/if}

		<div class="acard-sync acard-sync-{account.status}">
			<span class="acard-sync-dot"><StatusIcon status={account.status} /></span>
			<span>{d.syncText}</span>
		</div>
	</div>
{/if}

<style>
	.acard {
		position: fixed;
		/* Rendered via a body-level portal (portal.ts) — needs to beat Actual's
		   own stacking contexts, not just other sidebar elements. */
		z-index: 9999997;
		width: 292px;
		padding: 12px 13px 11px;
		background: var(--sb-canvas);
		border: 1px solid var(--abt-ink-2);
		border-radius: var(--abt-radius-lg);
		box-shadow: 0 12px 34px var(--sb-shadow);
		color: var(--abt-ink);
		pointer-events: none;
		animation: acard-in 0.13s ease;
	}
	@keyframes acard-in {
		from {
			opacity: 0;
			transform: translateX(-4px);
		}
		to {
			opacity: 1;
			transform: none;
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
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.acard {
			animation: none;
		}
	}
	.acard-head {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.acard-status {
		flex-shrink: 0;
		display: flex;
	}
	.acard-status :global(.status) {
		width: 15px;
		height: 15px;
	}
	.acard-title {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.acard-name {
		font-size: var(--abt-text-lg);
		font-weight: 650;
		letter-spacing: 0.1px;
		color: var(--abt-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.acard-sub {
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-soft);
	}
	.acard-balrow {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 11px;
	}
	.acard-ballabel {
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--abt-soft);
	}
	.acard-bal {
		font-size: 19px;
		font-weight: 500;
		letter-spacing: 0.2px;
		color: var(--abt-ink);
		font-variant-numeric: tabular-nums;
	}
	.acard-bal.neg {
		color: var(--sb-danger);
	}
	.acard-chart {
		margin-top: 6px;
	}
	.acard-chart svg {
		display: block;
		width: 100%;
		height: 52px;
	}
	.acard-chart svg.up {
		color: var(--sb-success);
	}
	.acard-chart svg.down {
		color: var(--sb-danger);
	}
	.acard-chart-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 3px;
	}
	.acard-period {
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-soft);
	}
	.acard-delta {
		font-size: var(--abt-text-sm);
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
	.acard-delta.up {
		color: var(--sb-success);
	}
	.acard-delta.down {
		color: var(--sb-danger);
	}
	.acard-delta-abs {
		margin-left: 3px;
		font-weight: 600;
		color: var(--abt-soft);
	}
	.acard-div {
		height: 1px;
		margin: 11px -13px;
		background: var(--sb-surface-hover);
	}
	.acard-lines {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.acard-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.acard-line .k {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--abt-text-base);
		color: var(--abt-ink);
	}
	.acard-line .v {
		font-size: var(--abt-text-base);
		font-weight: 600;
		color: var(--abt-ink);
		font-variant-numeric: tabular-nums;
	}
	.acard-line .v.neg {
		color: var(--sb-danger);
	}
	.acard-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-3);
		font-size: var(--abt-text-xs);
		font-weight: 700;
		color: var(--abt-ink);
	}
	.acard-block-label {
		margin-bottom: 7px;
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--abt-soft);
	}
	.acard-sched {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.acard-date {
		flex-shrink: 0;
		width: 42px;
		font-size: var(--abt-text-sm);
		font-weight: 600;
		color: var(--abt-soft);
		font-variant-numeric: tabular-nums;
	}
	.acard-payee {
		flex: 1 1 auto;
		min-width: 0;
		font-size: var(--abt-text-base);
		color: var(--abt-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.acard-amt {
		flex-shrink: 0;
		font-size: var(--abt-text-base);
		font-weight: 600;
		color: var(--sb-success);
		font-variant-numeric: tabular-nums;
	}
	.acard-amt.neg {
		color: var(--sb-danger);
	}
	.acard-sync {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-top: 11px;
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-soft);
	}
	.acard-sync-dot {
		display: flex;
	}
	.acard-sync-dot :global(.status) {
		width: 12px;
		height: 12px;
	}
	.acard-sync-error {
		color: var(--sb-danger);
	}
	.acard-sync-syncing {
		color: var(--sb-attention);
	}
</style>
