<script lang="ts">
	import { navigate } from "@lib/utilities/actual-api";
	import { fmtMoney } from "@lib/utilities/currency";
	import { getCategoryName, parseScheduleAmount } from "./data";
	import type { CategoryInsight, LinkedSchedule, ProgressInfo } from "./types";

	const {
		entry,
		progress,
		onClose,
	}: {
		entry: CategoryInsight;
		progress: ProgressInfo;
		onClose: () => void;
	} = $props();

	const ratio = $derived(
		progress.denominator && progress.denominator > 0 ? (progress.numerator ?? 0) / progress.denominator : 0,
	);
	const ratioPct = $derived(Math.round(ratio * 100));

	function todayIso(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	function daysBetween(from: string, to: string): number {
		const [fy, fm, fd] = from.split("-").map(Number);
		const [ty, tm, td] = to.split("-").map(Number);
		const a = new Date(fy, fm - 1, fd).getTime();
		const b = new Date(ty, tm - 1, td).getTime();
		return Math.round((b - a) / 86400000);
	}

	function relativeDay(iso: string): string {
		if (!iso) return "";
		const diff = daysBetween(todayIso(), iso);
		if (diff === 0) return "today";
		if (diff === 1) return "tomorrow";
		if (diff === -1) return "yesterday";
		if (diff > 1) return `in ${diff} days`;
		return `${-diff} days ago`;
	}

	function fmtDateShort(iso: string): string {
		if (!iso) return "—";
		const [y, m, d] = iso.split("-");
		return `${m}/${d}/${y.slice(2)}`;
	}

	function pluralize(n: number, unit: string): string {
		return n === 1 ? unit : `${unit}s`;
	}

	function fmtMonth(month: string): string {
		const [y, m] = month.split("-").map(Number);
		if (!y || !m) return month;
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
	}

	function percentCategoryLabel(category: string): string {
		if (category === "all income" || category === "available funds") return category;
		return getCategoryName(category) ?? category;
	}

	function getScheduleStatus(link: LinkedSchedule): string {
		if (link.schedule.completed) return "completed";
		if (link.paid) return "paid";
		return "upcoming";
	}

	function getDisplayDate(link: LinkedSchedule): string {
		return link.paid ? link.paidDate || "" : link.schedule.next_date;
	}

	function openScheduleModal(schedId: string) {
		onClose();
		navigate("/schedules");
		let tries = 0;
		const step = () => {
			const row = document.querySelector<HTMLElement>(`[data-focus-key="${schedId}"] [data-testid="row"]`);
			if (row) {
				row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
				return;
			}
			if (++tries < 40) setTimeout(step, 100);
		};
		setTimeout(step, 120);
	}

	const firstSched = $derived(entry.linkedSchedules[0]?.schedule);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			onClose();
			return;
		}
		if ((e.key === "f" || e.key === "F") && firstSched) {
			const t = e.target as HTMLElement;
			if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			e.preventDefault();
			openScheduleModal(firstSched.id);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="pop">
	<div class="pop__header">
		<div class="pop__title">{entry.name}</div>
		<div class="pop__totals">
			<span class="abt-privacy-number">{fmtMoney(progress.numerator ?? 0)}</span>
			<span class="pop__sep">/</span>
			<span class="abt-privacy-number">{progress.denominator ? fmtMoney(progress.denominator) : "—"}</span>
			{#if progress.denominator}
				<span class="pop__ratio abt-privacy-number">{ratioPct}%</span>
			{/if}
		</div>
		{#if progress.denominator && progress.denominator > 0}
			<div class="pop__bar">
				<div class="pop__bar-fill" style="width: {Math.min(100, ratio * 100)}%"></div>
			</div>
		{/if}
	</div>

	<ul class="pop__templates">
		{#each entry.directives as d}
			{@const link = d.type === "schedule" ? entry.linkedSchedules.find((ls) => ls.directive === d) : null}
			<li class="pop__tpl" class:pop__tpl--missing={d.type === "schedule" && !link}>
				<span class="pop__priority" class:pop__priority--none={d.priority == null}>
					{d.priority != null ? `#${d.priority}` : "—"}
				</span>
				<div class="pop__tpl-body">
					{#if d.type === "schedule" && link}
						{@const amt = parseScheduleAmount(link.schedule)}
						{@const status = getScheduleStatus(link)}
						{@const displayDate = getDisplayDate(link)}
						<div class="pop__sched-row1">
							<span class="pop__sched-name">{link.schedule.name || d.name}</span>
							<span class="pop__sched-amt abt-privacy-number">{fmtMoney(amt ?? 0)}</span>
							<span class="pop__status pop__status--{status}">{status}</span>
						</div>
						<div class="pop__sched-row2">
							<span>{fmtDateShort(displayDate)}</span>
							{#if displayDate}
								<span class="pop__sched-rel">{relativeDay(displayDate)}</span>
							{/if}
						</div>
					{:else if d.type === "schedule"}
						<div class="pop__missing">Schedule "{d.name}" not found</div>
					{:else if d.type === "simple"}
						<div class="pop__raw abt-privacy-number">
							{#if d.limit}
								Up to {fmtMoney(Math.round(d.limit.amount * 100))}
							{:else if d.monthly != null}
								{fmtMoney(Math.round(d.monthly * 100))}/mo
							{:else}
								Simple template
							{/if}
						</div>
					{:else if d.type === "average"}
						<div class="pop__raw">Average of last {d.numMonths} months</div>
					{:else if d.type === "periodic"}
						<div class="pop__raw abt-privacy-number">
							{fmtMoney(Math.round(d.amount * 100))} every {d.period.amount}
							{pluralize(d.period.amount, d.period.period)}
							{#if d.limit}
								(up to {fmtMoney(Math.round(d.limit * 100))})
							{/if}
						</div>
					{:else if d.type === "by"}
						<div class="pop__raw abt-privacy-number">
							Save {fmtMoney(Math.round(d.amount * 100))} by {fmtMonth(d.month)}{#if d.annual}, repeating yearly{:else if d.repeat}, every {d.repeat} {pluralize(
									d.repeat,
									"month",
								)}{/if}{#if d.from} &middot; spend from {fmtMonth(d.from)}{/if}
						</div>
					{:else if d.type === "spend"}
						<div class="pop__raw abt-privacy-number">
							Save {fmtMoney(Math.round(d.amount * 100))} by {fmtMonth(d.month)} &middot; spend from {fmtMonth(d.from)}
						</div>
					{:else if d.type === "percentage"}
						<div class="pop__raw">
							{d.percent}% of {percentCategoryLabel(d.category)}
							{#if d.previous}
								(last month)
							{/if}
						</div>
					{:else if d.type === "copy"}
						<div class="pop__raw">
							Copy amount from {d.lookBack}
							{pluralize(d.lookBack, "month")} ago
							{#if d.limit}
								(up to {fmtMoney(Math.round(d.limit * 100))})
							{/if}
						</div>
					{:else if d.type === "remainder"}
						<div class="pop__raw">
							Remainder split (weight {d.weight})
							{#if d.limit}
								&middot; up to {fmtMoney(Math.round(d.limit * 100))}
							{/if}
						</div>
					{:else if d.type === "limit"}
						<div class="pop__raw abt-privacy-number">
							Limit {fmtMoney(Math.round(d.amount * 100))} / {d.period}
							{#if d.hold}
								(hold over-limit funds)
							{/if}
						</div>
					{:else if d.type === "refill"}
						<div class="pop__raw">Refill to limit each period</div>
					{:else if d.type === "goal"}
						<div class="pop__raw abt-privacy-number">Goal balance of {fmtMoney(Math.round(d.amount * 100))}</div>
					{:else}
						<div class="pop__raw">{JSON.stringify(d as unknown)}</div>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	{#if firstSched}
		<div class="pop__hint">
			<kbd class="pop__kbd">F</kbd>
			<span>Edit {firstSched.name || "schedule"}</span>
		</div>
	{/if}
</div>

<style>
	.pop {
		min-width: 280px;
		max-width: 440px;
		font-size: 12px;
		padding: 10px 12px;
	}

	.pop__header {
		margin-bottom: 8px;
	}
	.pop__title {
		font-weight: 600;
		font-size: 13px;
		margin-bottom: 4px;
	}

	.pop__totals {
		display: flex;
		align-items: center;
		gap: 4px;
		opacity: 0.85;
	}

	.pop__sep {
		opacity: 0.5;
	}

	.pop__ratio {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.pop__bar {
		margin-top: 6px;
		height: 4px;
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
		border-radius: 2px;
		overflow: hidden;
	}

	.pop__bar-fill {
		height: 100%;
		background: var(--color-noticeTextLight);
	}

	.pop__templates {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pop__tpl {
		display: flex;
		gap: 8px;
		padding: 6px 8px;
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
		border-radius: 4px;
	}

	.pop__priority {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--color-formInputBorderSelected);
		min-width: 22px;
	}

	.pop__priority--none {
		opacity: 0.4;
		font-weight: 400;
	}

	.pop__tpl-body {
		flex: 1;
		min-width: 0;
	}

	.pop__raw {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 11px;
		opacity: 0.7;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pop__sched-row1 {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.pop__sched-row2 {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-top: 2px;
		font-size: 11px;
		opacity: 0.75;
	}

	.pop__sched-name {
		font-weight: 600;
	}

	.pop__sched-amt {
		font-variant-numeric: tabular-nums;
		margin-left: auto;
	}

	.pop__sched-rel::before {
		content: "· ";
		opacity: 0.6;
	}

	.pop__status {
		padding: 1px 6px;
		border-radius: 10px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}

	.pop__status--upcoming {
		background: color-mix(in srgb, var(--color-formInputBorderSelected) 20%, transparent);
		color: var(--color-formInputBorderSelected);
	}

	.pop__status--paid {
		background: color-mix(in srgb, var(--color-noticeTextLight) 20%, transparent);
		color: var(--color-noticeTextLight);
	}

	.pop__status--completed {
		background: color-mix(in srgb, var(--color-pageText) 15%, transparent);
		color: var(--color-pageTextSubdued);
	}

	.pop__missing {
		margin-top: 3px;
		font-size: 11px;
		color: var(--color-errorText);
	}

	.pop__hint {
		margin-top: 8px;
		padding-top: 6px;
		border-top: 1px solid color-mix(in srgb, var(--color-pageText) 8%, transparent);
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		opacity: 0.7;
	}

	.pop__kbd {
		display: inline-block;
		padding: 1px 5px;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--color-pageText) 20%, transparent);
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		line-height: 1.2;
	}
</style>
