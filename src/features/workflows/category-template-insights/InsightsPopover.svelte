<script lang="ts">
	import { navigate } from "@lib/utilities/actual-api";
	import { fmtMoney } from "@lib/utilities/currency";
	import { formatDate, loadDatePrefs } from "@lib/utilities/date-format.svelte";
	import { isoDate } from "@lib/utilities/months";
	import { getCategoryName, parseScheduleAmount, progressState } from "./data";
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
		progress.denominator && progress.denominator > 0
			? (progress.numerator ?? 0) / progress.denominator
			: 0,
	);
	const ratioPct = $derived(Math.round(ratio * 100));
	const hasGoal = $derived(!!progress.denominator && progress.denominator > 0);
	const remaining = $derived(Math.max(0, (progress.denominator ?? 0) - (progress.numerator ?? 0)));
	const state = $derived(progressState(entry, ratio));

	function daysBetween(from: string, to: string): number {
		const [fy, fm, fd] = from.split("-").map(Number);
		const [ty, tm, td] = to.split("-").map(Number);
		const a = new Date(fy, fm - 1, fd).getTime();
		const b = new Date(ty, tm - 1, td).getTime();
		return Math.round((b - a) / 86400000);
	}

	function relativeDay(iso: string): string {
		if (!iso) return "";
		const diff = daysBetween(isoDate(), iso);
		if (diff === 0) return "today";
		if (diff === 1) return "tomorrow";
		if (diff === -1) return "yesterday";
		if (diff > 1) return `in ${diff} days`;
		return `${-diff} days ago`;
	}

	loadDatePrefs();

	function fmtDateShort(iso: string): string {
		return iso ? formatDate(iso) : "—";
	}

	// Limits store their period as an adverb ("monthly").
	function periodUnit(period: string): string {
		const units: Record<string, string> = {
			daily: "day",
			weekly: "week",
			monthly: "month",
			yearly: "year",
		};
		return units[period] ?? period;
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

	function scheduleWhen(status: string, date: string): [string, string?] {
		if (status === "completed") return ["Completed"];
		if (!date) return [status === "paid" ? "Paid" : "No date"];
		const day = fmtDateShort(date);
		return [status === "paid" ? `Paid ${day}` : day, relativeDay(date)];
	}

	// One priority for every template is shown once, by the heading, instead of on each row.
	const sharedPriority = $derived.by(() => {
		const set = new Set(entry.directives.map((d) => d.priority ?? null));
		return set.size === 1 ? [...set][0] : undefined;
	});

	function openScheduleModal(schedId: string) {
		onClose();
		navigate("/schedules");
		let tries = 0;
		const step = () => {
			const row = document.querySelector<HTMLElement>(
				`[data-focus-key="${schedId}"] [data-testid="row"]`,
			);
			if (row) {
				row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
				return;
			}
			if (++tries < 40) setTimeout(step, 100);
		};
		setTimeout(step, 120);
	}

	// F is only a shortcut when there's no doubt which schedule it means.
	const onlySched = $derived(
		entry.linkedSchedules.length === 1 ? entry.linkedSchedules[0].schedule : undefined,
	);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			onClose();
			return;
		}
		if ((e.key === "f" || e.key === "F") && onlySched) {
			const t = e.target as HTMLElement;
			if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			e.preventDefault();
			openScheduleModal(onlySched.id);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="pop" data-state={state}>
	<div class="pop__head">
		<span class="pop__title">{entry.name}</span>
		{#if hasGoal}
			<span class="pop__pct abt-privacy-number">{ratioPct}%</span>
		{/if}
	</div>

	{#if hasGoal}
		<div class="pop__hero">
			<span class="pop__funded abt-privacy-number">{fmtMoney(progress.numerator ?? 0)}</span>
			<span class="pop__of">
				of <span class="abt-privacy-number">{fmtMoney(progress.denominator ?? 0)}</span>
				{progress.isLongGoal ? "goal" : "this month"}
				<span class="pop__sep">&middot;</span>
				{#if remaining > 0}
					<span class="abt-privacy-number">{fmtMoney(remaining)}</span> to go
				{:else}
					funded
				{/if}
			</span>
		</div>
		<div class="pop__bar">
			<div class="pop__fill" style:width="{Math.min(100, ratio * 100)}%"></div>
		</div>
	{/if}

	<div class="pop__section abt-label">
		<span>{entry.directives.length === 1 ? "Template" : "Templates"}</span>
		{#if sharedPriority != null}
			<span class="pop__prio">Priority {sharedPriority}</span>
		{/if}
	</div>
	<ul class="pop__list">
		{#each entry.directives as d, i (i)}
			{@const link =
				d.type === "schedule" ? entry.linkedSchedules.find((ls) => ls.directive === d) : null}
			<li>
				<div class="pop__item">
					{#if d.type === "schedule" && link}
						{@const amt = parseScheduleAmount(link.schedule)}
						{@const status = getScheduleStatus(link)}
						{@const displayDate = getDisplayDate(link)}
						{@const [when, rel] = scheduleWhen(status, displayDate)}
						<span class="pop__dot pop__dot--{status}"></span>
						<div class="pop__body">
							<div class="pop__line">
								<span class="pop__name">{link.schedule.name || d.name}</span>
								<span class="pop__amt abt-privacy-number">{fmtMoney(amt ?? 0)}</span>
							</div>
							<div class="pop__meta">
								{when}{#if rel}<span class="pop__sep">&middot;</span>{rel}{/if}
							</div>
						</div>
					{:else}
						<span class="pop__dot"></span>
						<div class="pop__body pop__text">
							{#if d.type === "schedule"}
								<span class="pop__missing">Schedule "{d.name}" not found</span>
							{:else if d.type === "simple"}
								<span class="abt-privacy-number">
									{#if d.limit}
										Up to {fmtMoney(Math.round(d.limit.amount * 100))}
									{:else if d.monthly != null}
										{fmtMoney(Math.round(d.monthly * 100))} a month
									{:else}
										Simple template
									{/if}
								</span>
							{:else if d.type === "average"}
								Average of the last {d.numMonths} months
							{:else if d.type === "periodic"}
								<span class="abt-privacy-number">
									{fmtMoney(Math.round(d.amount * 100))} every {d.period.amount}
									{pluralize(d.period.amount, d.period.period)}{#if d.limit}, up to {fmtMoney(
											Math.round(d.limit * 100),
										)}{/if}
								</span>
							{:else if d.type === "by"}
								<span class="abt-privacy-number">
									Save {fmtMoney(Math.round(d.amount * 100))} by {fmtMonth(d.month)}{#if d.annual},
										repeating yearly{:else if d.repeat}, every {d.repeat}
										{pluralize(d.repeat, "month")}{/if}{#if d.from}, spending from {fmtMonth(
											d.from,
										)}{/if}
								</span>
							{:else if d.type === "spend"}
								<span class="abt-privacy-number">
									Save {fmtMoney(Math.round(d.amount * 100))} by {fmtMonth(d.month)}, spending from
									{fmtMonth(d.from)}
								</span>
							{:else if d.type === "percentage"}
								{d.percent}% of {percentCategoryLabel(d.category)}{#if d.previous}, last month{/if}
							{:else if d.type === "copy"}
								Same as {d.lookBack}
								{pluralize(d.lookBack, "month")} ago{#if d.limit}, up to
									<span class="abt-privacy-number">{fmtMoney(Math.round(d.limit * 100))}</span>{/if}
							{:else if d.type === "remainder"}
								Share of what's left (weight {d.weight}){#if d.limit}, up to
									<span class="abt-privacy-number">{fmtMoney(Math.round(d.limit * 100))}</span>{/if}
							{:else if d.type === "limit"}
								<span class="abt-privacy-number">
									Limit of {fmtMoney(Math.round(d.amount * 100))} per {periodUnit(
										d.period,
									)}{#if d.hold}, holding the rest{/if}
								</span>
							{:else if d.type === "refill"}
								Refill to the limit each period
							{:else if d.type === "goal"}
								<span class="abt-privacy-number">
									Reach a balance of {fmtMoney(Math.round(d.amount * 100))}
								</span>
							{:else}
								{JSON.stringify(d as unknown)}
							{/if}
						</div>
					{/if}
					{#if d.priority != null && sharedPriority === undefined}
						<span class="pop__prio" title="Priority">#{d.priority}</span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	{#if onlySched}
		<div class="pop__hint">
			<kbd class="pop__kbd">F</kbd>
			<span>Edit {onlySched.name || "schedule"}</span>
		</div>
	{/if}
</div>

<style>
	.pop {
		--pop-tone: var(--abt-accent);
		width: max-content;
		min-width: 320px;
		max-width: 440px;
		padding: var(--abt-space-4);
		font-size: var(--abt-text-base);
	}

	/* Matches the row's bar. */
	.pop[data-state="near"] {
		--pop-tone: var(--color-warningText);
	}

	.pop:is([data-state="full"], [data-state="paid"]) {
		--pop-tone: var(--color-noticeTextLight);
	}

	.pop__head {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}

	.pop__title {
		min-width: 0;
		overflow: hidden;
		font-size: var(--abt-text-md);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pop__pct {
		margin-left: auto;
		padding: 1px var(--abt-space-3);
		border-radius: var(--abt-radius-pill);
		background: color-mix(in srgb, var(--pop-tone) 16%, transparent);
		color: var(--pop-tone);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.pop__hero {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--abt-space-3);
		margin-top: var(--abt-space-3);
	}

	.pop__funded {
		font-size: var(--abt-text-xl);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.pop__of {
		color: var(--abt-muted);
		font-variant-numeric: tabular-nums;
	}

	.pop__sep {
		margin-inline: var(--abt-space-2);
		color: var(--abt-subtle);
		font-weight: 700;
	}

	.pop__bar {
		height: 4px;
		margin-top: var(--abt-space-3);
		overflow: hidden;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-fill);
	}

	.pop__fill {
		height: 100%;
		border-radius: inherit;
		background: var(--pop-tone);
	}

	.pop__section {
		display: flex;
		justify-content: space-between;
		margin: var(--abt-space-5) 0 var(--abt-space-3);
	}

	.pop__list {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pop__item {
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) var(--abt-space-4);
		border-radius: var(--abt-radius-sm);
		background: var(--abt-ink-1);
	}

	.pop__dot {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-subtle);
		/* Centred on the first line's text. */
		transform: translateY(-1px);
	}

	.pop__dot--upcoming {
		background: var(--abt-accent);
	}

	.pop__dot--paid {
		background: var(--color-noticeTextLight);
	}

	.pop__body {
		flex: 1;
		min-width: 0;
	}

	.pop__text {
		color: var(--abt-muted);
	}

	.pop__line {
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-3);
	}

	.pop__name {
		min-width: 0;
		overflow: hidden;
		font-weight: 500;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pop__amt {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.pop__meta {
		margin-top: var(--abt-space-1);
		color: var(--abt-soft);
		font-size: var(--abt-text-sm);
	}

	.pop__missing {
		color: var(--color-errorText);
	}

	.pop__prio {
		flex-shrink: 0;
		color: var(--abt-subtle);
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
	}

	.pop__hint {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-line);
		color: var(--abt-soft);
		font-size: var(--abt-text-sm);
	}

	.pop__kbd {
		min-width: 16px;
		padding: 0 var(--abt-space-2);
		border: 1px solid var(--abt-ink-4);
		border-bottom-width: 2px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-ink-2);
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-xs);
		font-weight: 600;
		text-align: center;
	}
</style>
