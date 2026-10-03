<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import { SIDEBAR_ATTR } from "@features/core/side-panel/api";
	import Switch from "@lib/components/Switch.svelte";
	import type { Account, Category, Payee, Schedule, Transaction } from "@lib/types/actual-schema";
	import { query, send } from "@lib/utilities/actual-api";
	import { getCategoryColor, loadCategoryColors } from "@lib/utilities/category-colors";
	import { fmtMoney, loadCurrency } from "@lib/utilities/currency";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import { getValue, setValue } from "@lib/utilities/store";
	import { mount, onMount, tick, unmount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import DayDetail from "./DayDetail.svelte";
	import DayHeader from "./DayHeader.svelte";
	import type { DayTransaction } from "./types";

	const { onClose } = $props<{ onClose: () => void }>();

	const HIDE_OFFBUDGET_KEY = "spending-calendar-hide-offbudget";
	/** How far ahead the month nav can go, so paging forward stays bounded. */
	const MAX_FUTURE_MONTHS = 12;

	interface DayData {
		date: number;
		iso: string;
		total: number;
		/** Posted outflows only, for the heat tint. */
		spent: number;
		transactions: DayTransaction[];
		hasMissed: boolean;
		isToday: boolean;
		isFuture: boolean;
		isCurrentMonth: boolean;
	}

	let year = $state(new Date().getFullYear());
	let month = $state(new Date().getMonth());
	let days = $state<DayData[]>([]);
	let loading = $state(true);
	let hasLoadedOnce = $state(false);
	let payeeMap = new Map<string, string>();
	let payeeTransferAcctMap = new Map<string, string | null>();
	let categoryMap = $state(new Map<string, string>());
	let incomeCategoryIds = new Set<string>();
	let accountMap = new Map<string, string>();
	let accountOffbudgetMap = new Map<string, boolean>();
	/** Expanded recurrence dates per schedule id, grown as the user pages further ahead. */
	const upcomingDates = new Map<string, { count: number; dates: string[] }>();
	let hideOffBudget = $state(true);
	let selectedIso = $state<string | null>(null);
	let focusIso = $state<string | null>(null);
	let pendingFocus: { open: boolean } | null = null;
	let navDir = $state(0);
	let gridVersion = $state(0);
	let loadSeq = 0;
	let pageEl = $state<HTMLElement | null>(null);
	let gridEl = $state<HTMLElement | null>(null);
	let pickerOpen = $state(false);
	let pickerYear = $state(new Date().getFullYear());
	let pickerButton = $state<HTMLElement | null>(null);
	let pickerMenu = $state<HTMLElement | null>(null);
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let filtersOpen = $state(false);
	let filterButton = $state<HTMLElement | null>(null);
	let filterMenu = $state<HTMLElement | null>(null);
	let detailInstance: ReturnType<typeof mount> | null = null;
	let detailContainer: HTMLElement | null = null;
	let headerInstance: ReturnType<typeof mount> | null = null;
	let headerContainer: HTMLElement | null = null;

	const monthNames = [
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
	const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	const isAtCurrentMonth = $derived(() => {
		const now = new Date();
		return year === now.getFullYear() && month === now.getMonth();
	});

	/** Months between the given month (default: displayed) and the current one — negative for the past. */
	function monthsFromNow(y = year, m = month): number {
		const now = new Date();
		return (y - now.getFullYear()) * 12 + (m - now.getMonth());
	}

	const isAtMaxMonth = $derived(() => monthsFromNow() >= MAX_FUTURE_MONTHS);

	function setMonth(y: number, m: number): boolean {
		if (monthsFromNow(y, m) > MAX_FUTURE_MONTHS) return false;
		navDir = Math.sign((y - year) * 12 + (m - month));
		year = y;
		month = m;
		loadMonth();
		return true;
	}

	function prevMonth() {
		const d = new Date(year, month - 1, 1);
		setMonth(d.getFullYear(), d.getMonth());
	}

	function nextMonth() {
		const d = new Date(year, month + 1, 1);
		setMonth(d.getFullYear(), d.getMonth());
	}

	function goToday() {
		const now = new Date();
		setMonth(now.getFullYear(), now.getMonth());
	}

	/**
	 * Mirrors the budget page's Spent/Income: category activity, so refunds net out
	 * and uncategorized money or on-budget transfers don't count.
	 */
	const summary = $derived.by(() => {
		let spent = 0;
		let income = 0;
		let upcoming = 0;
		let hasUpcoming = false;
		for (const d of days) {
			if (!d.isCurrentMonth) continue;
			for (const t of d.transactions) {
				if (t.missed) continue;
				if (t.upcoming) {
					upcoming += t.amount;
					hasUpcoming = true;
				} else if (!t.categoryId) continue;
				else if (incomeCategoryIds.has(t.categoryId)) income += t.amount;
				else spent -= t.amount;
			}
		}
		return { spent, income, net: income - spent, upcoming, hasUpcoming };
	});

	const maxSpent = $derived(Math.max(0, ...days.map((d) => d.spent)));

	/** sqrt so mid-sized days still register next to one huge outlier. */
	function heat(day: DayData): number {
		return day.isCurrentMonth && maxSpent > 0 ? Math.sqrt(day.spent / maxSpent) : 0;
	}

	/** The one day cell reachable with Tab; arrows move from there. */
	const tabIso = $derived.by(() => {
		const inMonth = (iso: string | null) =>
			!!iso && days.some((d) => d.isCurrentMonth && d.iso === iso);
		if (inMonth(focusIso)) return focusIso;
		if (inMonth(selectedIso)) return selectedIso;
		return days.find((d) => d.isToday)?.iso ?? days.find((d) => d.isCurrentMonth)?.iso ?? null;
	});

	function corner(idx: number, len: number): string | undefined {
		if (idx === 0) return "tl";
		if (idx === 6) return "tr";
		if (idx === len - 7) return "bl";
		if (idx === len - 1) return "br";
		return undefined;
	}

	function hasTx(day: DayData): boolean {
		return day.isCurrentMonth && day.transactions.length > 0;
	}

	function moreTitle(hidden: (DayTransaction & { count: number })[]): string | undefined {
		if (document.body.classList.contains("abt-privacy-enabled")) return undefined;
		return hidden.map((t) => (t.count > 1 ? `${t.payee} ×${t.count}` : t.payee)).join("\n");
	}

	function focusCell(iso: string, open: boolean) {
		pageEl?.querySelector<HTMLElement>(`[data-iso="${iso}"]`)?.focus();
		const day = days.find((d) => d.isCurrentMonth && d.iso === iso);
		if (open && day && hasTx(day)) openDayPanel(day);
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

	const ARROW_STEPS: Record<string, number> = {
		ArrowLeft: -1,
		ArrowRight: 1,
		ArrowUp: -7,
		ArrowDown: 7,
	};

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
			const withTx = days.filter(hasTx);
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

	function formatAmount(cents: number): string {
		return fmtMoney(cents);
	}

	function parseScheduleAmount(raw: unknown): number {
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

	function isoDate(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	/**
	 * Mirrors Actual's own paid-matching window (`getScheduleOccurrenceMatchStartDate`):
	 * a manual schedule can be paid up to two days early, while an auto-posting or
	 * fixed-date one always lands exactly on its date.
	 */
	function occurrenceMatchStart(s: Schedule, occurrenceDate: string): string {
		if (s.posts_transaction || typeof s._date === "string") return occurrenceDate;
		const d = new Date(`${occurrenceDate}T00:00:00`);
		d.setDate(d.getDate() - 2);
		return isoDate(d);
	}

	/**
	 * Whether a past occurrence was eventually paid. Actual links a posted transaction
	 * back to its schedule, so that link — not payee text — decides this. The month's
	 * own transactions can't answer it alone: a bill paid late lands outside the month
	 * being viewed, so this asks for anything linked at or after the match window.
	 */
	async function wasOccurrencePosted(s: Schedule, occurrenceDate: string): Promise<boolean> {
		try {
			const rows = await query<Transaction[]>("transactions", {
				filter: {
					$and: [{ schedule: s.id }, { date: { $gte: occurrenceMatchStart(s, occurrenceDate) } }],
				},
				select: ["id"],
			});
			return rows.length > 0;
		} catch (e) {
			console.warn("[ABT Calendar] could not check schedule posting", s.id, e);
			return false;
		}
	}

	/**
	 * A schedule only carries `next_date` — its single next occurrence — so a month
	 * further out would otherwise come up empty. Actual expands the recurrence rule
	 * itself (patterns, intervals, end conditions, weekend skipping), so ask it
	 * rather than reimplementing those rules here.
	 */
	async function loadUpcomingDates(s: Schedule, count: number): Promise<string[]> {
		const cached = upcomingDates.get(s.id);
		if (cached && cached.count >= count) return cached.dates;
		let dates: string[] = [];
		try {
			dates = await send<string[]>("schedule/get-upcoming-dates", { config: s._date, count });
		} catch (e) {
			console.warn("[ABT Calendar] could not expand schedule", s.id, e);
		}
		upcomingDates.set(s.id, { count, dates });
		return dates;
	}

	async function setHideOffBudget(hidden: boolean) {
		hideOffBudget = hidden;
		navDir = 0;
		closeDayPanel();
		await setValue(HIDE_OFFBUDGET_KEY, hidden);
		loadMonth();
	}

	function dedupeTransactions(txs: DayTransaction[]): (DayTransaction & { count: number })[] {
		const map = new Map<string, DayTransaction & { count: number }>();
		for (const tx of txs) {
			const key = `${tx.payee}|${tx.upcoming ? "u" : tx.missed ? "m" : "r"}`;
			const existing = map.get(key);
			if (existing) {
				existing.count++;
				existing.amount += tx.amount;
			} else {
				map.set(key, { ...tx, count: 1 });
			}
		}
		return Array.from(map.values());
	}

	async function loadMonth() {
		const seq = ++loadSeq;
		loading = true;

		try {
			const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
			const endDay = new Date(year, month + 1, 0).getDate();
			const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

			const [transactions, schedules, payees, categories, accounts] = await Promise.all([
				query<Transaction[]>("transactions", {
					filter: { $and: [{ date: { $gte: startDate } }, { date: { $lte: endDate } }] },
				}),
				query<Schedule[]>("schedules"),
				payeeMap.size ? Promise.resolve(null) : query<Payee[]>("payees"),
				categoryMap.size ? Promise.resolve(null) : query<Category[]>("categories"),
				accountMap.size ? Promise.resolve(null) : query<Account[]>("accounts"),
			]);

			if (payees) {
				payeeMap = new Map(payees.map((p) => [p.id, p.name]));
				payeeTransferAcctMap = new Map(payees.map((p) => [p.id, p.transfer_acct ?? null]));
			}
			if (categories) {
				categoryMap = new Map(categories.map((c) => [c.id, c.name]));
				incomeCategoryIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id));
			}
			if (accounts) {
				accountMap = new Map(accounts.map((a) => [a.id, a.name]));
				accountOffbudgetMap = new Map(accounts.map((a) => [a.id, a.offbudget]));
			}

			const today = new Date();
			const firstDayOfWeek = new Date(year, month, 1).getDay();
			const daysInMonth = new Date(year, month + 1, 0).getDate();
			const daysInPrevMonth = new Date(year, month, 0).getDate();

			// A transfer between two accounts with the same on/off-budget status is
			// just money moving between buckets (no real spending), so it's excluded
			// entirely; a transfer crossing the on/off-budget boundary acts like a
			// real expense/income and is kept.
			const transactionById = new Map(transactions.map((t) => [t.id, t]));
			function isPureTransfer(t: Transaction): boolean {
				if (!t.transfer_id) return false;
				const other = transactionById.get(t.transfer_id);
				if (!other) return false;
				const fromOff = accountOffbudgetMap.get(t.account);
				const toOff = accountOffbudgetMap.get(other.account);
				if (fromOff == null || toOff == null) return false;
				return fromOff === toOff;
			}
			function isPureTransferSchedule(s: Schedule): boolean {
				if (!s._payee) return false;
				const transferAcct = payeeTransferAcctMap.get(s._payee);
				if (!transferAcct) return false;
				const fromOff = accountOffbudgetMap.get(s._account || "");
				const toOff = accountOffbudgetMap.get(transferAcct);
				if (fromOff == null || toOff == null) return false;
				return fromOff === toOff;
			}

			const byDay = new Map<number, DayTransaction[]>();
			for (const t of transactions) {
				if (!t.date || isPureTransfer(t)) continue;
				if (hideOffBudget && accountOffbudgetMap.get(t.account)) continue;
				const day = parseInt(t.date.split("-")[2]);
				if (!byDay.has(day)) byDay.set(day, []);
				byDay.get(day)!.push({
					payee: (t.payee && payeeMap.get(t.payee)) || "Unknown",
					amount: typeof t.amount === "number" ? t.amount : 0,
					categoryId: t.category || "",
					categoryName: (t.category && categoryMap.get(t.category)) || "",
					accountName: accountMap.get(t.account) || "",
					notes: t.notes || "",
				});
			}

			// Add upcoming schedules to the calendar
			const visibleSchedules = schedules.filter(
				(s) =>
					!s.completed &&
					!s.tombstone &&
					!isPureTransferSchedule(s) &&
					!(hideOffBudget && s._account && accountOffbudgetMap.get(s._account)),
			);

			const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
			const todayIso = isoDate(today);
			const occurrences = new Map<string, Set<string>>();
			function addOccurrence(id: string, date: string) {
				const dates = occurrences.get(id) ?? new Set<string>();
				dates.add(date);
				occurrences.set(id, dates);
			}

			// A `next_date` that has already passed is Actual's marker for a missed
			// schedule — it stays parked there until the schedule is paid, completed,
			// or deleted (the latter two are filtered out above).
			for (const s of visibleSchedules) {
				if (s.next_date?.startsWith(monthPrefix)) addOccurrence(s.id, s.next_date);
			}

			// `next_date` is only ever the *next* occurrence, so any month from the
			// current one onward needs the recurrence expanded to find the rest. The
			// expansion starts at today, so past days never gain projected entries.
			const monthsAhead = monthsFromNow();
			if (monthsAhead >= 0) {
				const count = Math.min((monthsAhead + 1) * 31 + 1, 400);
				await Promise.all(
					visibleSchedules.map(async (s) => {
						// A one-off schedule stores a plain date, not a recurrence to expand.
						if (!s._date || typeof s._date === "string") return;
						const dates = await loadUpcomingDates(s, count);
						for (const d of dates) {
							if (d.startsWith(monthPrefix)) addOccurrence(s.id, d);
						}
					}),
				);
			}

			// Drop past occurrences that were eventually paid, so a bill only reads as
			// missed for as long as it actually is one.
			const posted = new Set<string>();
			await Promise.all(
				visibleSchedules.flatMap((s) =>
					Array.from(occurrences.get(s.id) ?? new Set<string>(), async (date) => {
						if (date >= todayIso) return;
						if (await wasOccurrencePosted(s, date)) posted.add(`${s.id}|${date}`);
					}),
				),
			);

			for (const s of visibleSchedules) {
				const dates = occurrences.get(s.id);
				if (!dates) continue;
				const payeeName = s.name || (s._payee && payeeMap.get(s._payee)) || "Unknown";
				for (const date of dates) {
					if (posted.has(`${s.id}|${date}`)) continue;
					const sd = Number(date.slice(-2));
					if (!byDay.has(sd)) byDay.set(sd, []);
					const existing = byDay.get(sd)!;
					// Skip if a real transaction with the same payee already exists on this day
					if (existing.some((t) => !t.upcoming && !t.missed && t.payee === payeeName)) continue;
					existing.push({
						payee: payeeName,
						amount: parseScheduleAmount(s._amount),
						categoryId: "",
						categoryName: "",
						accountName: (s._account && accountMap.get(s._account)) || "",
						notes: "",
						...(date < todayIso ? { missed: true } : { upcoming: true }),
					});
				}
			}

			const grid: DayData[] = [];

			// Previous month padding
			for (let i = firstDayOfWeek - 1; i >= 0; i--) {
				grid.push(paddingDay(new Date(year, month - 1, daysInPrevMonth - i)));
			}

			// Current month
			for (let d = 1; d <= daysInMonth; d++) {
				const txs = byDay.get(d) || [];
				const total = txs.reduce((sum, t) => sum + (t.missed ? 0 : t.amount), 0);
				const spent = txs.reduce(
					(sum, t) => sum + (!t.missed && !t.upcoming && t.amount < 0 ? -t.amount : 0),
					0,
				);
				const iso = `${monthPrefix}${String(d).padStart(2, "0")}`;
				grid.push({
					date: d,
					iso,
					total,
					spent,
					transactions: txs,
					hasMissed: txs.some((t) => t.missed),
					isToday: iso === todayIso,
					isFuture: iso > todayIso,
					isCurrentMonth: true,
				});
			}

			// Next month padding
			const remaining = 7 - (grid.length % 7);
			if (remaining < 7) {
				for (let d = 1; d <= remaining; d++) {
					grid.push(paddingDay(new Date(year, month + 1, d)));
				}
			}

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

	function paddingDay(d: Date): DayData {
		return {
			date: d.getDate(),
			iso: isoDate(d),
			total: 0,
			spent: 0,
			transactions: [],
			hasMissed: false,
			isToday: false,
			isFuture: false,
			isCurrentMonth: false,
		};
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
		if (!hasTx(day)) return;

		cleanupPanel();

		const date = new Date(year, month, day.date);
		selectedIso = isoDate(date);
		const total = day.transactions.reduce((s, t) => s + (t.missed ? 0 : t.amount), 0);

		headerContainer = document.createElement("div");
		headerInstance = mount(DayHeader, {
			target: headerContainer,
			props: {
				dateStr: date.toLocaleDateString(undefined, {
					month: "numeric",
					day: "numeric",
					year: "numeric",
				}),
				total,
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
			title: `${monthNames[month]} ${day.date}`,
			bodyNode: detailContainer,
			headerNode: headerContainer,
		});
	}

	function closeDayPanel() {
		sidepanel.close();
		cleanupPanel();
		selectedIso = null;
	}

	function isSelected(day: DayData): boolean {
		return day.isCurrentMonth && selectedIso === day.iso;
	}

	$effect(() => {
		if (!filtersOpen || !filterMenu || !filterButton) return;
		positionPopover(filterMenu, filterButton, { align: "right" });
		return onOutsideClick([filterMenu, filterButton], () => (filtersOpen = false));
	});

	$effect(() => {
		if (!pickerOpen || !pickerMenu || !pickerButton) return;
		positionPopover(pickerMenu, pickerButton);
		return onOutsideClick([pickerMenu, pickerButton], () => (pickerOpen = false));
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

<div class="cal-page" bind:this={pageEl}>
	<div class="cal-header">
		<div class="cal-header__left">
			<button
				type="button"
				class="cal-title"
				title="Jump to month"
				aria-haspopup="dialog"
				aria-expanded={pickerOpen}
				bind:this={pickerButton}
				onclick={() => {
					pickerYear = year;
					pickerOpen = !pickerOpen;
				}}
			>
				{monthNames[month]}
				{year}
				<svg
					class="cal-title__chevron"
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
			{#if hasLoadedOnce}
				<dl class="cal-summary" class:is-stale={loading}>
					<div>
						<dt>Spent</dt>
						<dd class="abt-privacy-number">{formatAmount(summary.spent)}</dd>
					</div>
					<div>
						<dt>Income</dt>
						<dd class="abt-privacy-number is-pos">{formatAmount(summary.income)}</dd>
					</div>
					<div>
						<dt>Net</dt>
						<dd
							class="abt-privacy-number"
							class:is-pos={summary.net > 0}
							class:is-neg={summary.net < 0}
						>
							{fmtMoney(summary.net, { sign: true })}
						</dd>
					</div>
					{#if summary.hasUpcoming}
						<div class="is-upcoming">
							<dt>Upcoming</dt>
							<dd class="abt-privacy-number">{fmtMoney(summary.upcoming, { sign: true })}</dd>
						</div>
					{/if}
				</dl>
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
				onclick={prevMonth}
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
			<button class="cal-today" onclick={goToday} disabled={isAtCurrentMonth()}>Today</button>
			<button
				class="cal-nav"
				title="Next month"
				aria-label="Next month"
				onclick={nextMonth}
				disabled={isAtMaxMonth()}
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
			{#each dayNames as name (name)}
				<div class="cal-day-name">{name}</div>
			{/each}
			{#each { length: 35 } as _, idx (idx)}
				<div class="cal-cell cal-cell--skeleton" data-corner={corner(idx, 35)}>
					<span class="cal-skel cal-skel--date"></span>
					{#if idx % 3 !== 1}
						<span class="cal-skel" style="width: {40 + ((idx * 37) % 45)}%"></span>
					{/if}
				</div>
			{/each}
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
				{#each dayNames as name (name)}
					<div class="cal-day-name">{name}</div>
				{/each}

				{#each days as day, idx (idx)}
					{@const h = heat(day)}
					<!-- Roving tabindex: every in-month day is focusable for arrow navigation. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						class="cal-cell"
						class:is-today={day.isToday}
						class:is-selected={isSelected(day)}
						class:is-future={day.isFuture}
						class:is-muted={!day.isCurrentMonth}
						class:is-clickable={hasTx(day)}
						style={h > 0 ? `--heat-raw: ${h.toFixed(3)}` : undefined}
						data-corner={corner(idx, days.length)}
						data-iso={day.isCurrentMonth ? day.iso : undefined}
						role={hasTx(day) ? "button" : undefined}
						aria-pressed={hasTx(day) ? isSelected(day) : undefined}
						tabindex={day.isCurrentMonth ? (day.iso === tabIso ? 0 : -1) : undefined}
						onfocus={() => {
							if (day.isCurrentMonth) focusIso = day.iso;
						}}
						onclick={() => openDayPanel(day)}
						onkeydown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								openDayPanel(day);
							}
						}}
					>
						<div class="cal-cell__header">
							<span class="cal-cell__datewrap">
								<span class="cal-cell__date" class:is-today={day.isToday}>{day.date}</span>
								{#if day.hasMissed}
									<span class="cal-cell__missed" title="Missed schedule"></span>
								{/if}
							</span>
							{#if day.total !== 0 && day.isCurrentMonth}
								<span
									class="cal-cell__total abt-privacy-number"
									class:is-neg={day.total < 0}
									class:is-pos={day.total > 0}
								>
									{fmtMoney(day.total, { short: true, sign: true })}
								</span>
							{/if}
						</div>

						{#if hasTx(day)}
							{@const deduped = dedupeTransactions(day.transactions)}
							<div class="cal-cell__txs">
								{#each deduped.slice(0, 3) as tx, i (i)}
									<div class="cal-tx" class:is-upcoming={tx.upcoming} class:is-missed={tx.missed}>
										<span
											class="cal-tx__dot"
											style="background: {tx.upcoming
												? 'var(--color-pageTextSubdued)'
												: tx.missed
													? 'var(--color-errorText)'
													: getCategoryColor(tx.categoryId)}"
										></span>
										<span class="cal-tx__payee abt-privacy-number">{tx.payee}</span>
										{#if tx.count > 1}
											<span class="cal-tx__count">×{tx.count}</span>
										{/if}
									</div>
								{/each}
								{#if deduped.length > 3}
									<div class="cal-tx">
										<span class="cal-more" title={moreTitle(deduped.slice(3))}
											>+{deduped.length - 3} more</span
										>
									</div>
								{/if}
							</div>

							<div class="cal-cell__bars">
								{#each Object.entries(day.transactions.reduce((acc, t) => {
											if (!t.missed && t.amount < 0) {
												acc[t.categoryId] = (acc[t.categoryId] || 0) + Math.abs(t.amount);
											}
											return acc;
										}, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]) as [catId, amount] (catId)}
									{@const pct = Math.max(8, (amount / Math.abs(day.total || 1)) * 100)}
									<div
										class="cal-bar"
										style="width: {pct}%; background: {getCategoryColor(catId)}"
										title="{categoryMap.get(catId) || 'Uncategorized'}: {formatAmount(-amount)}"
									></div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/key}
	{/if}

	{#if filtersOpen}
		<div class="cal-popover cal-filters" bind:this={filterMenu}>
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

	{#if pickerOpen}
		{@const now = new Date()}
		<div
			class="cal-popover cal-picker"
			role="dialog"
			aria-label="Jump to month"
			bind:this={pickerMenu}
		>
			<div class="cal-picker__head">
				<button
					type="button"
					class="cal-nav cal-nav--sm"
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
				<span class="cal-picker__year">{pickerYear}</span>
				<button
					type="button"
					class="cal-nav cal-nav--sm"
					aria-label="Next year"
					disabled={monthsFromNow(pickerYear + 1, 0) > MAX_FUTURE_MONTHS}
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
			<div class="cal-picker__months">
				{#each monthNames as name, m (name)}
					<button
						type="button"
						class="cal-picker__month"
						class:is-active={pickerYear === year && m === month}
						class:is-current={pickerYear === now.getFullYear() && m === now.getMonth()}
						aria-current={pickerYear === year && m === month ? "date" : undefined}
						disabled={monthsFromNow(pickerYear, m) > MAX_FUTURE_MONTHS}
						onclick={() => {
							pickerOpen = false;
							setMonth(pickerYear, m);
						}}
					>
						{name.slice(0, 3)}
					</button>
				{/each}
			</div>
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

	.cal-title {
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
		font-size: 25px;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
		transition: background 0.1s;
	}
	.cal-title:hover,
	.cal-title[aria-expanded="true"] {
		background: var(--color-tableRowBackgroundHover);
	}
	.cal-title__chevron {
		opacity: 0.45;
		transition: transform 0.15s;
	}
	.cal-title[aria-expanded="true"] .cal-title__chevron {
		transform: rotate(180deg);
	}

	.cal-header__left {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.cal-summary {
		display: flex;
		gap: 20px;
		margin: 0;
		padding-left: 16px;
		border-left: 1px solid var(--color-tableBorder);
		transition: opacity 0.15s;
	}
	.cal-summary.is-stale {
		opacity: 0.5;
	}
	.cal-summary > div {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.cal-summary dt {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
	}
	.cal-summary dd {
		margin: 0;
		font-size: 13px;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.cal-summary dd.is-pos {
		color: var(--color-noticeTextLight);
	}
	.cal-summary dd.is-neg {
		color: var(--color-errorText);
	}
	.cal-summary .is-upcoming dd {
		font-style: italic;
		opacity: 0.65;
	}

	@container (max-width: 820px) {
		.cal-summary .is-upcoming {
			display: none;
		}
	}
	@container (max-width: 680px) {
		.cal-summary {
			display: none;
		}
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

	.cal-popover {
		position: fixed;
		z-index: 9999;
		padding: 4px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.cal-filters {
		min-width: 200px;
	}

	.cal-picker {
		width: 220px;
		padding: 8px;
	}
	.cal-picker__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.cal-picker__year {
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.cal-nav.cal-nav--sm {
		width: 26px;
		height: 26px;
	}
	.cal-picker__months {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
	}
	.cal-picker__month {
		padding: 7px 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageText);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.cal-picker__month:hover:not(:disabled):not(.is-active) {
		background: var(--color-tableRowBackgroundHover);
	}
	.cal-picker__month.is-current:not(.is-active) {
		box-shadow: inset 0 0 0 1px var(--color-tableBorder);
	}
	.cal-picker__month.is-active {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 600;
	}
	.cal-picker__month:disabled {
		opacity: 0.3;
		cursor: default;
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

	.cal-nav:disabled,
	.cal-today:disabled {
		opacity: 0.2;
		cursor: default;
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

	.cal-cell[data-corner="tl"] {
		border-top-left-radius: clamp(0px, var(--border-radius, 0.5rem), 0.75rem);
	}
	.cal-cell[data-corner="tr"] {
		border-top-right-radius: clamp(0px, var(--border-radius, 0.5rem), 0.75rem);
	}
	.cal-cell[data-corner="bl"] {
		border-bottom-left-radius: clamp(0px, var(--border-radius, 0.5rem), 0.75rem);
	}
	.cal-cell[data-corner="br"] {
		border-bottom-right-radius: clamp(0px, var(--border-radius, 0.5rem), 0.75rem);
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

	.cal-cell {
		min-height: 100px;
		border: 1px solid var(--color-tableBorder);
		margin: -0.5px;
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow: hidden;
		transition: background 0.1s;
		--heat: var(--heat-raw, 0);
		--cell-bg: color-mix(
			in srgb,
			var(--color-errorText) calc(var(--heat) * 10%),
			var(--color-tableBackground)
		);
		background: var(--cell-bg);
	}
	/* The tint would reveal spending patterns that privacy mode blurs. */
	:global(body.abt-privacy-enabled) .cal-cell {
		--heat: 0;
	}

	.cal-cell.is-clickable {
		cursor: pointer;
	}

	.cal-cell.is-clickable:hover,
	.cal-cell.is-today {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 6%, var(--cell-bg));
	}

	.cal-cell.is-selected,
	.cal-cell.is-selected:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 12%, var(--cell-bg));
		box-shadow: inset 0 0 0 1.5px var(--color-sidebarItemAccentSelected);
	}

	.cal-cell:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 1.5px
			color-mix(in srgb, var(--color-sidebarItemAccentSelected) 60%, transparent);
	}

	.cal-cell.is-selected .cal-cell__date:not(.is-today) {
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 700;
		opacity: 1;
	}

	/* Half step between table and page, matching the budget table's other-month columns. */
	.cal-cell.is-muted {
		background: color-mix(in srgb, var(--color-tableBackground), var(--color-pageBackground));
		border-color: color-mix(in srgb, var(--color-tableBorder) 50%, var(--color-pageBackground));
	}
	.cal-cell.is-muted > * {
		opacity: 0.5;
	}

	.cal-cell__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 2px;
	}

	.cal-cell__datewrap {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.cal-cell__date {
		font-size: 12px;
		font-weight: 500;
		opacity: 0.6;
	}
	.cal-cell.is-future .cal-cell__date {
		opacity: 0.35;
	}

	.cal-cell__missed {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-errorText);
	}

	.cal-cell__date.is-today {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 25%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 700;
		opacity: 1;
		color: color-contrast(var(--color-sidebarItemAccentSelected)) !important;
	}

	.cal-cell__total {
		font-size: 10px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.cal-cell__total.is-neg {
		color: var(--color-errorText);
	}

	.cal-cell__total.is-pos {
		color: var(--color-noticeTextLight);
	}

	.cal-cell__txs {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow: hidden;
	}

	.cal-tx {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		line-height: 1.5;
		min-width: 0;
	}

	.cal-tx__dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.cal-tx__payee {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		opacity: 0.8;
	}

	.cal-tx__count {
		font-size: 9px;
		font-weight: 600;
		color: var(--color-pageTextSubdued);
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
		padding: 0 4px;
		border-radius: 4px;
		flex-shrink: 0;
		line-height: 1.5;
	}

	.cal-more {
		margin-left: 9px;
		padding: 0 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-pageText) 8%, transparent);
		color: var(--color-pageTextSubdued);
		font-size: 9px;
		font-weight: 600;
		line-height: 1.6;
	}

	.cal-skel {
		display: block;
		height: 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-pageText) 8%, transparent);
	}
	.cal-skel--date {
		width: 14px;
		height: 10px;
		margin-bottom: 6px;
	}
	@media (prefers-reduced-motion: no-preference) {
		.cal-skel {
			animation: cal-pulse 1.2s ease-in-out infinite;
		}
	}
	@keyframes cal-pulse {
		50% {
			opacity: 0.45;
		}
	}

	.cal-tx.is-upcoming {
		opacity: 0.45;
		font-style: italic;
	}

	.cal-tx.is-missed {
		opacity: 0.75;
	}

	.cal-tx.is-missed .cal-tx__payee {
		color: var(--color-errorText);
		text-decoration: line-through;
		text-decoration-color: color-mix(in srgb, var(--color-errorText) 45%, transparent);
	}

	.cal-tx.is-upcoming .cal-tx__dot {
		border: 1px dashed var(--color-pageTextSubdued);
		background: transparent !important;
		width: 7px;
		height: 7px;
	}

	.cal-cell__bars {
		display: flex;
		gap: 1px;
		margin-top: auto;
		padding-top: 4px;
	}

	.cal-bar {
		height: 3px;
		border-radius: 1.5px;
		min-width: 4px;
		opacity: 0.7;
	}
</style>
