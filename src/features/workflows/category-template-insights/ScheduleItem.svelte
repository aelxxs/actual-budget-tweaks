<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";
	import { formatDate, loadDatePrefs } from "@lib/utilities/date-format.svelte";
	import { isoDate } from "@lib/utilities/months";
	import { getAccountName, parseScheduleAmount } from "./data";
	import type { LinkedSchedule } from "./types";

	const { link, fallbackName = "" }: { link: LinkedSchedule; fallbackName?: string } = $props();

	loadDatePrefs();

	function daysBetween(from: string, to: string): number {
		const [fy, fm, fd] = from.split("-").map(Number);
		const [ty, tm, td] = to.split("-").map(Number);
		const a = new Date(fy, fm - 1, fd).getTime();
		const b = new Date(ty, tm - 1, td).getTime();
		return Math.round((b - a) / 86400000);
	}

	function relativeDay(iso: string): string {
		const diff = daysBetween(isoDate(), iso);
		if (diff === 0) {
			return "today";
		}
		if (diff === 1) {
			return "tomorrow";
		}
		if (diff === -1) {
			return "yesterday";
		}
		if (diff > 1) {
			return `in ${diff} days`;
		}
		return `${-diff} days ago`;
	}

	function when(): [string, string?] {
		const { status, paidDate, schedule } = link;
		if (status === "completed") {
			return ["Completed"];
		}
		if (status === "paid") {
			return [paidDate ? `Paid ${formatDate(paidDate)}` : "Paid"];
		}
		if (!schedule.next_date) {
			return ["No date"];
		}
		if (status === "due") {
			return ["Due today"];
		}
		const day = formatDate(schedule.next_date);
		return [status === "missed" ? `Missed ${day}` : day, relativeDay(schedule.next_date)];
	}

	function frequency(): string | null {
		const date = link.schedule._date as { frequency?: string; interval?: number } | null;
		if (!date || typeof date !== "object" || !date.frequency) {
			return null;
		}
		const interval = date.interval ?? 1;
		if (interval === 1) {
			return date.frequency[0].toUpperCase() + date.frequency.slice(1);
		}
		const unit = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[date.frequency];
		return unit ? `Every ${interval} ${unit}s` : null;
	}

	const amount = $derived(parseScheduleAmount(link.schedule));
	const meta = $derived(
		[...when(), frequency(), getAccountName(link.schedule._account)].filter(Boolean),
	);
</script>

<span class="sched__dot" data-status={link.status}></span>
<div class="sched__body">
	<div class="sched__line">
		<span class="sched__name">{link.schedule.name || fallbackName}</span>
		<span class="sched__amt abt-privacy-number">{fmtMoney(amount ?? 0)}</span>
	</div>
	<div class="sched__meta">
		{#each meta as part, i (i)}
			{#if i > 0}<span class="sched__sep">&middot;</span>{/if}{part}
		{/each}
	</div>
</div>

<style>
	/* Same colours as Actual's schedule icon in the Spent column. */
	.sched__dot {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-subtle);
		/* Centred on the first line's text. */
		transform: translateY(-1px);
	}

	.sched__dot[data-status="upcoming"] {
		background: var(--color-upcomingText);
	}

	.sched__dot[data-status="due"] {
		background: var(--color-templateNumberUnderFunded);
	}

	.sched__dot[data-status="missed"] {
		background: var(--color-budgetNumberNegative);
	}

	.sched__dot[data-status="paid"] {
		background: var(--color-noticeTextLight);
	}

	.sched__body {
		flex: 1;
		min-width: 0;
	}

	.sched__line {
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-3);
	}

	.sched__name {
		min-width: 0;
		overflow: hidden;
		font-weight: 500;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sched__amt {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.sched__meta {
		margin-top: var(--abt-space-1);
		color: var(--abt-soft);
		font-size: var(--abt-text-sm);
	}

	.sched__sep {
		margin-inline: var(--abt-space-2);
		color: var(--abt-subtle);
		font-weight: 700;
	}
</style>
