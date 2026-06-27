<script lang="ts">
	import { onMount } from "svelte";
	import { query, navigate } from "@lib/utilities/actual-api";

	interface Schedule {
		id: string;
		name: string;
		next_date: string;
		completed: boolean;
		tombstone: boolean;
		_payee: string;
		_account: string;
		_amount: unknown;
	}

	interface Payee {
		id: string;
		name: string;
	}

	interface UpcomingItem {
		id: string;
		name: string;
		amount: number;
		date: string;
		daysUntil: number;
	}

	let items = $state<UpcomingItem[]>([]);
	let loading = $state(true);
	let error = $state(false);

	function parseAmount(raw: unknown): number {
		if (typeof raw === "number") return raw;
		if (typeof raw === "string") {
			try {
				const parsed = JSON.parse(raw);
				if (typeof parsed === "number") return parsed;
				if (parsed?.value != null) return parsed.value;
			} catch {
				return 0;
			}
		}
		if (raw && typeof raw === "object") {
			const obj = raw as Record<string, unknown>;
			if (typeof obj.value === "number") return obj.value;
		}
		return 0;
	}

	function daysUntil(dateStr: string): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const target = new Date(dateStr + "T00:00:00");
		return Math.ceil((target.getTime() - today.getTime()) / 86400000);
	}

	function formatDate(days: number): string {
		if (days === 0) return "Today";
		if (days === 1) return "Tmrw";
		return `${days}d`;
	}

	function formatAmount(cents: number): string {
		const abs = Math.abs(cents) / 100;
		return "$" + abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
	}

	async function load() {
		try {
			const [schedules, payees] = await Promise.all([
				query<Schedule[]>("schedules"),
				query<Payee[]>("payees"),
			]);

			const payeeMap = new Map(payees.map((p) => [p.id, p.name]));

			const upcoming = schedules
				.filter((s) => !s.completed && !s.tombstone && s.next_date)
				.map((s) => {
					const days = daysUntil(s.next_date);
					const amount = parseAmount(s._amount);
					const name = s.name || payeeMap.get(s._payee) || "Unknown";
					return { id: s.id, name, amount, date: s.next_date, daysUntil: days };
				})
				.filter((s) => s.daysUntil >= 0)
				.sort((a, b) => a.daysUntil - b.daysUntil)
				.slice(0, 5);

			items = upcoming;
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		load();
	});
</script>

<div class="sched" role="button" tabindex="0" onclick={() => navigate("/schedules")} onkeydown={(e) => { if (e.key === "Enter") navigate("/schedules"); }}>
	<div class="sched__hd">
		<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
		<span>Upcoming</span>
	</div>

	{#if loading}
		<div class="sched__empty">Loading…</div>
	{:else if error}
		<div class="sched__empty">Failed to load</div>
	{:else if items.length === 0}
		<div class="sched__empty">No upcoming bills</div>
	{:else}
		<div class="sched__list">
			{#each items as item (item.id)}
				<div class="sched__row">
					<span class="sched__date" class:is-soon={item.daysUntil <= 1} class:is-near={item.daysUntil > 1 && item.daysUntil <= 3}>
						{formatDate(item.daysUntil)}
					</span>
					<span class="sched__name">{item.name}</span>
					<span class="sched__amt abt-privacy-number">
						{formatAmount(item.amount)}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sched {
		width: 100%;
		padding: 8px 10px 6px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		cursor: pointer;
	}

	.sched__hd {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		opacity: 0.4;
	}

	.sched__empty {
		font-size: 10px;
		opacity: 0.4;
		padding: 2px 0;
	}

	.sched__list {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.sched__row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		line-height: 1.3;
	}

	.sched__date {
		font-size: 9px;
		font-weight: 600;
		opacity: 0.4;
		min-width: 28px;
		flex-shrink: 0;
	}

	.sched__date.is-soon {
		opacity: 1;
		color: var(--color-warningText, #f59e0b);
	}

	.sched__date.is-near {
		opacity: 0.7;
	}

	.sched__name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.sched__amt {
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		flex-shrink: 0;
		font-size: 11px;
		opacity: 0.7;
	}
</style>
