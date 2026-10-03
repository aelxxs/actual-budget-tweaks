<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import { SIDEBAR_ATTR } from "@features/core/side-panel/api";
	import Switch from "@lib/components/Switch.svelte";
	import { loadCategoryColors } from "@lib/utilities/category-colors";
	import { loadCurrency } from "@lib/utilities/currency";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import { getValue, setValue } from "@lib/utilities/store";
	import { mount, onMount, tick, unmount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import CalendarSkeleton from "./CalendarSkeleton.svelte";
	import DayCell from "./DayCell.svelte";
	import DayDetail from "./DayDetail.svelte";
	import DayHeader from "./DayHeader.svelte";
	import MonthPicker from "./MonthPicker.svelte";
	import MonthSummary from "./MonthSummary.svelte";
	import {
		MAX_FUTURE_MONTHS,
		MONTH_NAMES,
		cellCorner,
		createMonthLoader,
		hasTransactions,
		isoDate,
		monthsFromNow,
	} from "./month-data";
	import { dayHeat, maxDaySpent, summarizeMonth } from "./summary";
	import type { DayData } from "./types";

	const { onClose } = $props<{ onClose: () => void }>();

	const HIDE_OFFBUDGET_KEY = "spending-calendar-hide-offbudget";
	const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const ARROW_STEPS: Record<string, number> = {
		ArrowLeft: -1,
		ArrowRight: 1,
		ArrowUp: -7,
		ArrowDown: 7,
	};
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const loader = createMonthLoader();

	let year = $state(new Date().getFullYear());
	let month = $state(new Date().getMonth());
	let days = $state<DayData[]>([]);
	let loading = $state(true);
	let hasLoadedOnce = $state(false);
	let loadSeq = 0;
	let navDir = $state(0);
	let gridVersion = $state(0);
	let hideOffBudget = $state(true);
	let selectedIso = $state<string | null>(null);
	let focusIso = $state<string | null>(null);
	let pendingFocus: { open: boolean } | null = null;
	let pageEl = $state<HTMLElement | null>(null);
	let gridEl = $state<HTMLElement | null>(null);
	let pickerOpen = $state(false);
	let filtersOpen = $state(false);
	let filterButton = $state<HTMLElement | null>(null);
	let filterMenu = $state<HTMLElement | null>(null);
	let detailInstance: ReturnType<typeof mount> | null = null;
	let detailContainer: HTMLElement | null = null;
	let headerInstance: ReturnType<typeof mount> | null = null;
	let headerContainer: HTMLElement | null = null;

	const isAtCurrentMonth = $derived(monthsFromNow(year, month) === 0);
	const isAtMaxMonth = $derived(monthsFromNow(year, month) >= MAX_FUTURE_MONTHS);
	// Days are reassigned after every load, so the loader's income set is current by then.
	const summary = $derived(summarizeMonth(days, loader.incomeCategoryIds));
	const maxSpent = $derived(maxDaySpent(days));

	/** The one day cell reachable with Tab; arrows move from there. */
	const tabIso = $derived.by(() => {
		const inMonth = (iso: string | null) =>
			!!iso && days.some((d) => d.isCurrentMonth && d.iso === iso);
		if (inMonth(focusIso)) return focusIso;
		if (inMonth(selectedIso)) return selectedIso;
		return days.find((d) => d.isToday)?.iso ?? days.find((d) => d.isCurrentMonth)?.iso ?? null;
	});

	function setMonth(y: number, m: number): boolean {
		if (monthsFromNow(y, m) > MAX_FUTURE_MONTHS) return false;
		navDir = Math.sign((y - year) * 12 + (m - month));
		year = y;
		month = m;
		loadMonth();
		return true;
	}

	function shiftMonth(delta: number) {
		const d = new Date(year, month + delta, 1);
		setMonth(d.getFullYear(), d.getMonth());
	}

	function goToday() {
		const now = new Date();
		setMonth(now.getFullYear(), now.getMonth());
	}

	async function loadMonth() {
		const seq = ++loadSeq;
		loading = true;
		try {
			const grid = await loader.load(year, month, { hideOffBudget });
			// A slower, older request must not overwrite the month paged to since.
			if (seq !== loadSeq) return;
			days = grid;
			gridVersion++;
			if (pendingFocus && focusIso) {
				const { open } = pendingFocus;
				pendingFocus = null;
				await tick();
				focusCell(focusIso, open);
			}
		} catch (e) {
			console.warn("[ABT Calendar]", e);
		} finally {
			if (seq === loadSeq) {
				loading = false;
				hasLoadedOnce = true;
			}
		}
	}

	async function setHideOffBudget(hidden: boolean) {
		hideOffBudget = hidden;
		navDir = 0;
		closeDayPanel();
		await setValue(HIDE_OFFBUDGET_KEY, hidden);
		loadMonth();
	}

	function focusCell(iso: string, open: boolean) {
		pageEl?.querySelector<HTMLElement>(`[data-iso="${iso}"]`)?.focus();
		const day = days.find((d) => d.isCurrentMonth && d.iso === iso);
		if (open && day && hasTransactions(day)) openDayPanel(day);
	}

	async function focusDate(d: Date, open: boolean) {
		const iso = isoDate(d);
		focusIso = iso;
		if (d.getFullYear() !== year || d.getMonth() !== month) {
			pendingFocus = { open };
			if (!setMonth(d.getFullYear(), d.getMonth())) pendingFocus = null;
			return;
		}
		await tick();
		focusCell(iso, open);
	}

	function isTyping(t: EventTarget | null): boolean {
		return (
			t instanceof HTMLElement &&
			(t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
		);
	}

	function onArrowKey(e: KeyboardEvent) {
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
		if (filtersOpen || pickerOpen) return;
		const target = e.target as Node;
		if (document.querySelector(`[${SIDEBAR_ATTR}]`)?.contains(target)) return;

		const step = ARROW_STEPS[e.key];
		if (!step) return;
		const inGrid = !!gridEl?.contains(target);
		// Outside the grid, arrows only drive the open day panel.
		if (!inGrid && !(selectedIso && target === document.body)) return;
		const from =
			(inGrid && (target as HTMLElement).closest<HTMLElement>("[data-iso]")?.dataset.iso) ||
			selectedIso ||
			tabIso;
		if (!from) return;
		e.preventDefault();

		const panelOpen = !!selectedIso;
		if (panelOpen && Math.abs(step) === 1) {
			const withTx = days.filter(hasTransactions);
			const next =
				step > 0
					? withTx.find((d) => d.iso > from)
					: [...withTx].reverse().find((d) => d.iso < from);
			if (next) {
				focusIso = next.iso;
				focusCell(next.iso, true);
			}
			return;
		}
		const d = new Date(`${from}T00:00:00`);
		d.setDate(d.getDate() + step);
		focusDate(d, panelOpen);
	}

	function cleanupPanel() {
		if (headerInstance) {
			unmount(headerInstance);
			headerInstance = null;
		}
		if (headerContainer) {
			headerContainer.remove();
			headerContainer = null;
		}
		if (detailInstance) {
			unmount(detailInstance);
			detailInstance = null;
		}
		if (detailContainer) {
			detailContainer.remove();
			detailContainer = null;
		}
	}

	function openDayPanel(day: DayData) {
		if (!hasTransactions(day)) return;

		cleanupPanel();

		const date = new Date(year, month, day.date);
		selectedIso = day.iso;

		headerContainer = document.createElement("div");
		headerInstance = mount(DayHeader, {
			target: headerContainer,
			props: {
				dateStr: date.toLocaleDateString(undefined, {
					month: "numeric",
					day: "numeric",
					year: "numeric",
				}),
				total: day.total,
			},
		});

		detailContainer = document.createElement("div");
		detailInstance = mount(DayDetail, {
			target: detailContainer,
			props: {
				date,
				transactions: day.transactions,
			},
		});

		sidepanel.open({
			title: `${MONTH_NAMES[month]} ${day.date}`,
			bodyNode: detailContainer,
			headerNode: headerContainer,
		});
	}

	function closeDayPanel() {
		sidepanel.close();
		cleanupPanel();
		selectedIso = null;
	}

	$effect(() => {
		if (!filtersOpen || !filterMenu || !filterButton) return;
		positionPopover(filterMenu, filterButton, { align: "right" });
		return onOutsideClick([filterMenu, filterButton], () => (filtersOpen = false));
	});

	onMount(() => {
		Promise.all([loadCurrency(), loadCategoryColors(), getValue(HIDE_OFFBUDGET_KEY, true)]).then(
			([, , off]) => {
				hideOffBudget = off;
				loadMonth();
			},
		);

		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				if (filtersOpen || pickerOpen) {
					filtersOpen = pickerOpen = false;
					return;
				}
				closeDayPanel();
				onClose();
				return;
			}
			onArrowKey(e);
		}
		window.addEventListener("keydown", onKey);
		// The panel's own close button doesn't notify us, so follow its presence instead.
		const unwatch = watchDom(() => {
			if (selectedIso && !sidepanel.isOpen()) selectedIso = null;
		});
		return () => {
			unwatch();
			window.removeEventListener("keydown", onKey);
			closeDayPanel();
		};
	});
</script>

{#snippet weekdays()}
	{#each DAY_NAMES as name (name)}
		<div class="cal-day-name">{name}</div>
	{/each}
{/snippet}

<div class="cal-page" bind:this={pageEl}>
	<div class="cal-header">
		<div class="cal-header__left">
			<MonthPicker {year} {month} bind:open={pickerOpen} onpick={setMonth} />
			{#if hasLoadedOnce}
				<MonthSummary {summary} stale={loading} />
			{/if}
		</div>
		<div class="cal-header__right">
			<button
				type="button"
				class="cal-nav"
				class:is-active={filtersOpen}
				title="Filters"
				aria-label="Filters"
				aria-expanded={filtersOpen}
				bind:this={filterButton}
				onclick={() => (filtersOpen = !filtersOpen)}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg
				>
			</button>
			<span class="cal-header__sep"></span>
			<button
				class="cal-nav"
				title="Previous month"
				aria-label="Previous month"
				onclick={() => shiftMonth(-1)}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
				>
			</button>
			<button class="cal-today" onclick={goToday} disabled={isAtCurrentMonth}>Today</button>
			<button
				class="cal-nav"
				title="Next month"
				aria-label="Next month"
				onclick={() => shiftMonth(1)}
				disabled={isAtMaxMonth}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
				>
			</button>
		</div>
	</div>

	{#if loading && !hasLoadedOnce}
		<div class="cal-grid" aria-busy="true" aria-label="Loading calendar">
			{@render weekdays()}
			<CalendarSkeleton />
		</div>
	{:else}
		{#key gridVersion}
			<div
				class="cal-grid"
				class:is-loading={loading}
				role="main"
				bind:this={gridEl}
				in:fly={{ x: navDir * 16, duration: reducedMotion ? 0 : 180, easing: cubicOut }}
			>
				{@render weekdays()}
				{#each days as day, idx (idx)}
					<DayCell
						{day}
						corner={cellCorner(idx, days.length)}
						heat={dayHeat(day, maxSpent)}
						selected={day.isCurrentMonth && selectedIso === day.iso}
						tabbable={day.iso === tabIso}
						categoryNames={loader.categoryNames}
						onopen={() => openDayPanel(day)}
						onfocus={() => (focusIso = day.iso)}
					/>
				{/each}
			</div>
		{/key}
	{/if}

	{#if filtersOpen}
		<div class="cal-filters" bind:this={filterMenu}>
			<div class="cal-filters__title">Show</div>
			<label class="cal-filters__row">
				<span>Off-budget accounts</span>
				<Switch
					checked={!hideOffBudget}
					onCheckedChange={(checked) => setHideOffBudget(!checked)}
				/>
			</label>
		</div>
	{/if}
</div>

<style>
	.cal-page {
		flex: 1;
		/* Transparent so the Background Pattern setting (painted on ancestors) shows through. */
		background: transparent;
		color: var(--color-pageText, #e0e0e0);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		container-type: inline-size;
	}

	.cal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 24px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--color-tableBorder);
	}

	.cal-header__left {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.cal-header__right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.cal-nav {
		width: 32px;
		height: 32px;
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

	.cal-nav:hover:not(:disabled) {
		opacity: 1;
		background: var(--color-tableRowBackgroundHover);
	}

	.cal-nav.is-active {
		opacity: 1;
		background: var(--color-tableRowBackgroundHover);
	}

	.cal-header__sep {
		width: 1px;
		height: 18px;
		margin: 0 2px;
		background: var(--color-tableBorder);
	}

	.cal-filters__title {
		padding: 5px 8px 4px;
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
	}

	.cal-filters__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 5px 8px;
		border-radius: 4px;
		font-size: 13px;
		cursor: pointer;
	}

	.cal-filters__row:hover {
		background: var(--color-tableRowBackgroundHover);
	}

	.cal-today {
		padding: 5px 14px;
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageText);
		cursor: pointer;
		transition: background 0.1s;
	}

	.cal-today:hover:not(:disabled) {
		background: var(--color-tableRowBackgroundHover);
	}

	.cal-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-template-rows: min-content;
		grid-auto-rows: 1fr;
		overflow-y: auto;
		padding: 0 12px 12px;
	}

	/* Delayed so quick loads don't flicker. */
	.cal-grid.is-loading {
		opacity: 0.6;
		transition: opacity 0.15s 0.12s;
	}

	.cal-day-name {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-pageTextSubdued);
		text-align: center;
		padding: 10px 0;
		position: sticky;
		top: 0;
		/* Sticky over scrolling cells, so mostly opaque; the blur keeps the pattern from reading as a seam. */
		background: color-mix(in srgb, var(--color-pageBackground, #1a1b26) 85%, transparent);
		backdrop-filter: blur(6px);
		z-index: 1;
		margin-bottom: 1px;
	}

	.cal-filters {
		position: fixed;
		z-index: 9999;
		min-width: 200px;
		padding: 4px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.cal-nav:disabled,
	.cal-today:disabled {
		opacity: 0.2;
		cursor: default;
	}
</style>
