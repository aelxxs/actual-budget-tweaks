<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import { SIDEBAR_ATTR } from "@features/core/side-panel/api";
	import { SCHEDULE_EDITOR } from "@lib/actual-dom";
	import MonthPicker from "@lib/components/MonthPicker.svelte";
	import { onListChange } from "@lib/utilities/actual-api";
	import { loadCategoryColors } from "@lib/utilities/category-colors";
	import { loadCurrency } from "@lib/utilities/currency";
	import {
		formatDate,
		formatDayMonth,
		loadDatePrefs,
		weekdayNames,
	} from "@lib/utilities/date-format.svelte";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { createLogger } from "@lib/utilities/logger";
	import { isoDate } from "@lib/utilities/months";
	import { mount, onMount, tick, unmount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import CalendarFilters from "./CalendarFilters.svelte";
	import CalendarSkeleton from "./CalendarSkeleton.svelte";
	import DayCell from "./DayCell.svelte";
	import DayDetail from "./DayDetail.svelte";
	import DayHeader from "./DayHeader.svelte";
	import MonthSummary from "./MonthSummary.svelte";
	import { loadFilters, saveFilters, type CalendarFilters as Filters } from "./filters";
	import {
		MAX_FUTURE_MONTHS,
		cellCorner,
		createMonthLoader,
		hasTransactions,
		monthsFromNow,
	} from "./month-data";
	import { dayHeat, maxDaySpent, summarizeMonth } from "./summary";
	import type { DayData } from "./types";

	const log = createLogger("calendar");

	const ARROW_STEPS: Record<string, number> = {
		ArrowLeft: -1,
		ArrowRight: 1,
		ArrowUp: -7,
		ArrowDown: 7,
	};
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const loader = createMonthLoader();

	// Set with each loaded grid, so the header row always matches the grid's columns.
	let firstDayOfWeek = $state(0);
	const dayNames = $derived(weekdayNames(firstDayOfWeek));

	let year = $state(new Date().getFullYear());
	let month = $state(new Date().getMonth());
	let days = $state<DayData[]>([]);
	let loading = $state(true);
	let hasLoadedOnce = $state(false);
	let loadSeq = 0;
	let navDir = $state(0);
	let gridVersion = $state(0);
	let filters = $state<Filters | null>(null);
	// What the filters list, refreshed from the loader after each load.
	let lists = $state({
		accounts: loader.accounts(),
		categories: loader.categories(),
		categoryGroups: loader.categoryGroups(),
	});
	let selectedIso = $state<string | null>(null);
	let focusIso = $state<string | null>(null);
	let pendingFocus: { open: boolean } | null = null;
	let pageEl = $state<HTMLElement | null>(null);
	let gridEl = $state<HTMLElement | null>(null);
	let pickerOpen = $state(false);
	let filtersOpen = $state(false);
	let detailInstance: ReturnType<typeof mount> | null = null;
	let detailContainer: HTMLElement | null = null;
	let headerInstance: ReturnType<typeof mount> | null = null;
	let headerContainer: HTMLElement | null = null;

	const isAtCurrentMonth = $derived(monthsFromNow(year, month) === 0);
	const isAtMaxMonth = $derived(monthsFromNow(year, month) >= MAX_FUTURE_MONTHS);
	const today = new Date();
	const maxPickerYear = new Date(
		today.getFullYear(),
		today.getMonth() + MAX_FUTURE_MONTHS,
	).getFullYear();
	// Days are reassigned after every load, so the loader's income set is current by then.
	const summary = $derived(summarizeMonth(days, loader.incomeCategoryIds));
	const maxSpent = $derived(maxDaySpent(days));

	/** The one day cell reachable with Tab; arrows move from there. */
	const tabIso = $derived.by(() => {
		const inMonth = (iso: string | null) =>
			!!iso && days.some((d) => d.isCurrentMonth && d.iso === iso);
		if (inMonth(focusIso)) {
			return focusIso;
		}
		if (inMonth(selectedIso)) {
			return selectedIso;
		}
		return days.find((d) => d.isToday)?.iso ?? days.find((d) => d.isCurrentMonth)?.iso ?? null;
	});

	function setMonth(y: number, m: number): boolean {
		if (monthsFromNow(y, m) > MAX_FUTURE_MONTHS) {
			return false;
		}
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

	/** A refilter keeps the month on screen, so its cells update in place instead of sliding in. */
	async function loadMonth({ refilter = false } = {}) {
		if (!filters) {
			return;
		}
		const seq = ++loadSeq;
		loading = !refilter;
		try {
			const prefs = await loadDatePrefs();
			const grid = await loader.load(year, month, {
				filters,
				firstDayOfWeek: prefs.firstDayOfWeek,
			});
			// A slower, older request must not overwrite the month paged to since.
			if (seq !== loadSeq) {
				return;
			}
			firstDayOfWeek = prefs.firstDayOfWeek;
			lists = {
				accounts: loader.accounts(),
				categories: loader.categories(),
				categoryGroups: loader.categoryGroups(),
			};
			days = grid;
			if (!refilter) {
				gridVersion++;
			}
			// Keeps an open day panel on the same day, showing what changed.
			if (refilter && selectedIso) {
				const day = grid.find((d) => d.isCurrentMonth && d.iso === selectedIso);
				if (day && hasTransactions(day)) {
					openDayPanel(day);
				} else {
					closeDayPanel();
				}
			}
			if (pendingFocus && focusIso) {
				const { open } = pendingFocus;
				pendingFocus = null;
				await tick();
				focusCell(focusIso, open);
			}
		} catch (e) {
			log.warn(e);
		} finally {
			if (seq === loadSeq) {
				loading = false;
				hasLoadedOnce = true;
			}
		}
	}

	function setFilters(patch: Partial<Filters>) {
		if (!filters) {
			return;
		}
		filters = { ...filters, ...patch };
		closeDayPanel();
		loadMonth({ refilter: true });
		saveFilters($state.snapshot(filters));
	}

	function focusCell(iso: string, open: boolean) {
		pageEl?.querySelector<HTMLElement>(`[data-iso="${iso}"]`)?.focus();
		const day = days.find((d) => d.isCurrentMonth && d.iso === iso);
		if (open && day && hasTransactions(day)) {
			openDayPanel(day);
		}
	}

	async function focusDate(d: Date, open: boolean) {
		const iso = isoDate(d);
		focusIso = iso;
		if (d.getFullYear() !== year || d.getMonth() !== month) {
			pendingFocus = { open };
			if (!setMonth(d.getFullYear(), d.getMonth())) {
				pendingFocus = null;
			}
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
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) {
			return;
		}
		if (filtersOpen || pickerOpen) {
			return;
		}
		const target = e.target as Node;
		if (document.querySelector(`[${SIDEBAR_ATTR}]`)?.contains(target)) {
			return;
		}

		const step = ARROW_STEPS[e.key];
		if (!step) {
			return;
		}
		const inGrid = !!gridEl?.contains(target);
		// Outside the grid, arrows only drive the open day panel.
		if (!inGrid && !(selectedIso && target === document.body)) {
			return;
		}
		const from =
			(inGrid && (target as HTMLElement).closest<HTMLElement>("[data-iso]")?.dataset.iso) ||
			selectedIso ||
			tabIso;
		if (!from) {
			return;
		}
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
		if (!hasTransactions(day)) {
			return;
		}

		cleanupPanel();

		const date = new Date(year, month, day.date);
		selectedIso = day.iso;
		const monthDays = days.filter((d) => d.isCurrentMonth);

		headerContainer = document.createElement("div");
		headerInstance = mount(DayHeader, {
			target: headerContainer,
			props: {
				dateStr: formatDate(date),
				total: day.total,
			},
		});

		detailContainer = document.createElement("div");
		detailInstance = mount(DayDetail, {
			target: detailContainer,
			props: {
				date,
				transactions: day.transactions,
				balances: monthDays.every((d) => d.balance !== undefined)
					? monthDays.map((d) => ({ balance: d.balance!, future: d.isFuture }))
					: undefined,
				dayIndex: day.date - 1,
			},
		});

		sidepanel.open({
			title: formatDayMonth(date, "long"),
			bodyNode: detailContainer,
			headerNode: headerContainer,
			key: "calendar-day",
		});
	}

	function closeDayPanel() {
		sidepanel.close("calendar-day");
		cleanupPanel();
		selectedIso = null;
	}

	onMount(() => {
		Promise.all([loadCurrency(), loadCategoryColors(), loadFilters()]).then(([, , saved]) => {
			filters = saved;
			loadMonth();
		});

		function onKey(e: KeyboardEvent) {
			// The calendar is a page, so Escape only closes its own popovers.
			if (e.key === "Escape" && (filtersOpen || pickerOpen)) {
				filtersOpen = pickerOpen = false;
				return;
			}
			onArrowKey(e);
		}
		window.addEventListener("keydown", onKey);
		// The panel's own close button doesn't notify us, so follow its presence instead.
		// A schedule edited in Actual's editor shows once the editor closes.
		let editorOpen = false;
		const unwatch = watchDom(() => {
			if (selectedIso && !sidepanel.isOpen("calendar-day")) {
				selectedIso = null;
			}
			const open = !!document.querySelector(SCHEDULE_EDITOR);
			if (editorOpen && !open) {
				loader.invalidate();
				loadMonth({ refilter: true });
			}
			editorOpen = open;
		});
		// Renames and new or closed accounts and categories, while the calendar is open.
		const stopLists = (["accounts", "categories", "payees"] as const).map((scope) =>
			onListChange(scope, () => {
				loader.forget(scope);
				loadMonth({ refilter: true });
			}),
		);
		return () => {
			unwatch();
			stopLists.forEach((stop) => stop());
			window.removeEventListener("keydown", onKey);
			closeDayPanel();
		};
	});
</script>

<div class="cal-page" bind:this={pageEl}>
	<div class="cal-header">
		<div class="cal-header__left">
			<MonthPicker
				{year}
				{month}
				bind:open={pickerOpen}
				onpick={setMonth}
				isDisabled={(y, m) => monthsFromNow(y, m) > MAX_FUTURE_MONTHS}
				maxYear={maxPickerYear}
			/>
			{#if hasLoadedOnce}
				<MonthSummary {summary} stale={loading} />
			{/if}
		</div>
		<div class="cal-header__right">
			{#if filters}
				<CalendarFilters bind:open={filtersOpen} {filters} {...lists} onChange={setFilters} />
			{/if}
			<span class="cal-header__sep"></span>
			<button
				class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
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
			<button class="abt-btn abt-btn--sm" onclick={goToday} disabled={isAtCurrentMonth}
				>Today</button
			>
			<button
				class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
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

	<!-- Outside the grid, so it stays put while the month slides. -->
	<div class="cal-weekdays">
		{#each dayNames as name (name)}
			<div class="cal-day-name">{name}</div>
		{/each}
	</div>

	{#if loading && !hasLoadedOnce}
		<div class="cal-grid" aria-busy="true" aria-label="Loading calendar">
			<CalendarSkeleton />
		</div>
	{:else}
		{#key gridVersion}
			<div
				class="cal-grid"
				class:is-loading={loading}
				role="main"
				bind:this={gridEl}
				in:fly={{
					x: navDir * 16,
					// The first grid replaces the skeleton in place; fading it in from nothing blinked.
					duration: reducedMotion || gridVersion === 1 ? 0 : 180,
					easing: cubicOut,
				}}
			>
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
		padding: var(--abt-space-3) var(--abt-page-gutter);
		flex-shrink: 0;
		/* Matches ABT's other page and panel headers. */
		box-sizing: border-box;
		min-height: var(--abt-panel-header-height);
		border-bottom: 1px solid var(--abt-panel-border);
		/* The month reads as this page's title, sized like the Reports title it opens over. */
		--abt-month-title-size: 20px; /* raw: no type token this large */
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

	.cal-header__sep {
		width: 1px;
		height: 18px;
		margin: 0 var(--abt-space-1);
		background: var(--abt-line);
	}

	/* The same gutter on both, so the columns line up when the grid scrolls. */
	.cal-weekdays,
	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		padding: 0 var(--abt-page-gutter);
		scrollbar-gutter: stable;
	}
	.cal-weekdays {
		flex-shrink: 0;
		overflow: hidden;
	}
	.cal-grid {
		flex: 1;
		grid-auto-rows: 1fr;
		overflow-y: auto;
		padding-bottom: var(--abt-page-gutter);
	}

	/* Delayed so quick loads don't flicker. */
	.cal-grid.is-loading {
		opacity: 0.6;
		transition: opacity 0.15s 0.12s;
	}

	.cal-day-name {
		font-size: var(--abt-text-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--abt-muted);
		text-align: center;
		padding: 10px 0;
		margin-bottom: 1px;
	}
</style>
