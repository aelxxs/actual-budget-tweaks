<script lang="ts" module>
	export type MonthMark = "ok" | "warn" | "future" | "muted";
</script>

<script lang="ts">
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";

	const MONTH_NAMES = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];

	let {
		year,
		month,
		span = 1,
		open = $bindable(false),
		onpick,
		isDisabled = () => false,
		loadMarks,
		variant = "title",
	}: {
		year: number;
		month: number;
		/** Months shown from `month` onward, highlighted as one range. */
		span?: number;
		open?: boolean;
		onpick: (year: number, month: number) => void;
		isDisabled?: (year: number, month: number) => boolean;
		/** Status dots for one picker year, keyed by month index. */
		loadMarks?: (year: number) => Promise<Partial<Record<number, MonthMark>>>;
		/** "title" is the calendar's page heading; "compact" sits inline in a toolbar. */
		variant?: "title" | "compact";
	} = $props();

	let pickerYear = $state(new Date().getFullYear());
	let marks = $state<Partial<Record<number, MonthMark>>>({});
	let button = $state<HTMLElement | null>(null);
	let menu = $state<HTMLElement | null>(null);

	const short = (m: number) => MONTH_NAMES[m].slice(0, 3);
	const startIdx = $derived(year * 12 + month);
	const label = $derived.by(() => {
		if (span <= 1) return `${MONTH_NAMES[month]} ${year}`;
		const end = new Date(year, month + span - 1, 1);
		const endYear = end.getFullYear();
		return endYear === year
			? `${short(month)} – ${short(end.getMonth())} ${year}`
			: `${short(month)} ${year} – ${short(end.getMonth())} ${endYear}`;
	});

	$effect(() => {
		if (!open || !menu || !button) return;
		positionPopover(menu, button);
		return onOutsideClick([menu, button], () => (open = false));
	});

	$effect(() => {
		if (!open || !loadMarks) return;
		const y = pickerYear;
		let stale = false;
		marks = {};
		loadMarks(y)
			.then((m) => {
				if (!stale) marks = m;
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});
</script>

<button
	type="button"
	class="title"
	class:is-compact={variant === "compact"}
	title="Jump to month"
	aria-haspopup="dialog"
	aria-expanded={open}
	bind:this={button}
	onclick={() => {
		pickerYear = year;
		open = !open;
	}}
>
	{label}
	<svg
		class="title__chevron"
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg
	>
</button>

{#if open}
	{@const now = new Date()}
	<div
		class="picker"
		class:is-compact={variant === "compact"}
		role="dialog"
		aria-label="Jump to month"
		bind:this={menu}
	>
		<div class="picker__head">
			<button
				type="button"
				class="picker__step"
				aria-label="Previous year"
				onclick={() => pickerYear--}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
				>
			</button>
			<span class="picker__year">{pickerYear}</span>
			<button
				type="button"
				class="picker__step"
				aria-label="Next year"
				disabled={isDisabled(pickerYear + 1, 0)}
				onclick={() => pickerYear++}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
				>
			</button>
		</div>
		<div class="picker__months">
			{#each MONTH_NAMES as name, m (name)}
				{@const idx = pickerYear * 12 + m}
				{@const mark = marks[m]}
				<button
					type="button"
					class="picker__month"
					class:is-active={idx === startIdx}
					class:is-in-range={idx > startIdx && idx < startIdx + span}
					class:is-current={pickerYear === now.getFullYear() && m === now.getMonth()}
					class:is-muted={mark === "muted"}
					aria-current={idx === startIdx ? "date" : undefined}
					disabled={isDisabled(pickerYear, m)}
					onclick={() => {
						open = false;
						onpick(pickerYear, m);
					}}
				>
					{name.slice(0, 3)}
					{#if mark && mark !== "muted"}
						<span class="picker__dot is-{mark}"></span>
					{/if}
				</button>
			{/each}
		</div>
		{#if loadMarks}
			<div class="picker__legend">
				<span><i class="picker__dot is-ok"></i>On track</span>
				<span><i class="picker__dot is-warn"></i>Needs attention</span>
				<span><i class="picker__dot is-future"></i>Future</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 0 -8px;
		padding: 2px 8px;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		font-size: var(--abt-month-title-size, 25px);
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
		transition: background 0.1s;
	}
	.title:hover,
	.title[aria-expanded="true"] {
		background: var(--color-tableRowBackgroundHover);
	}
	.title__chevron {
		opacity: 0.45;
		transition: transform 0.15s;
	}
	.title[aria-expanded="true"] .title__chevron {
		transform: rotate(180deg);
	}

	.picker {
		position: fixed;
		z-index: 9999;
		width: 220px;
		padding: 8px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}
	.picker__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.picker__year {
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.picker__step {
		width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageText);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.6;
		transition:
			opacity 0.1s,
			background 0.1s;
	}
	.picker__step:hover:not(:disabled) {
		opacity: 1;
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}
	.picker__step:disabled {
		opacity: 0.2;
		cursor: default;
	}
	.picker__months {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
	}
	.picker__month {
		position: relative;
		padding: 7px 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageText);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	/* Row hover is too close to the popover's own background to read here. */
	.picker__month:hover:not(:disabled):not(.is-active) {
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}
	.picker__month.is-current:not(.is-active) {
		box-shadow: inset 0 0 0 1px var(--color-tableBorder);
	}
	.picker__month.is-in-range {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 10%, transparent);
	}
	.picker__month.is-active {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 600;
	}
	.picker__month.is-muted {
		color: var(--color-pageTextSubdued);
	}
	.picker__month:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.picker__dot {
		display: inline-block;
		width: 4px;
		height: 4px;
		border-radius: 50%;
	}
	.picker__month .picker__dot {
		position: absolute;
		bottom: 3px;
		left: 50%;
		margin-left: -2px;
	}
	.picker__dot.is-ok {
		background: var(--color-noticeTextLight);
	}
	.picker__dot.is-warn {
		background: var(--color-errorText);
	}
	.picker__dot.is-future {
		box-shadow: inset 0 0 0 1px var(--color-pageTextSubdued);
	}
	.picker__legend {
		display: flex;
		justify-content: space-between;
		gap: 6px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--color-tableBorder);
		font-size: 10.5px;
		color: var(--color-pageTextSubdued);
	}
	.picker__legend span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}
	.picker__legend .picker__dot {
		width: 5px;
		height: 5px;
	}

	.title.is-compact {
		margin: 0;
		padding: 4px 10px;
		border-radius: var(--border-radius, 6px);
		font-size: 17px;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	/* Open is shown by the chevron alone; no box around the title. */
	.title.is-compact[aria-expanded="true"]:not(:hover) {
		background: none;
	}
	.title.is-compact:focus {
		outline: none;
	}
	.title.is-compact:focus-visible {
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--color-sidebarItemAccentSelected) 55%, transparent);
	}
	.title.is-compact .title__chevron {
		width: 16px;
		height: 16px;
		stroke-width: 2.5;
		opacity: 0.7;
	}
	.picker.is-compact {
		width: 264px;
		padding: 12px;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
	}
	.picker.is-compact .picker__head {
		margin-bottom: 8px;
	}
	.picker.is-compact .picker__months {
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
	}
	.picker.is-compact .picker__month {
		padding: 9px 0 13px;
		font-size: 12.5px;
		font-weight: 550;
	}
	/* Every shown month reads the same: a quiet tint with accent text. */
	.picker.is-compact .picker__month.is-active,
	.picker.is-compact .picker__month.is-in-range {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 14%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 650;
	}
	.picker.is-compact .picker__month.is-active:hover,
	.picker.is-compact .picker__month.is-in-range:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 24%, transparent);
	}
	.picker.is-compact .picker__month.is-current:not(.is-active):not(.is-in-range) {
		box-shadow: none;
		font-weight: 700;
	}
	.picker.is-compact .picker__month .picker__dot {
		width: 5px;
		height: 5px;
		bottom: 4px;
		margin-left: -2.5px;
	}
	.picker.is-compact .picker__legend {
		margin-top: 10px;
		padding-top: 10px;
		font-size: 11px;
	}
</style>
