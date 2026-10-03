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
