<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import { query } from "@lib/utilities/actual-api";
	import { getCategoryColor, loadCategoryColors } from "@lib/utilities/category-colors";
	import { loadCurrency, fmtMoney } from "@lib/utilities/currency";
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import { getValue, setValue } from "@lib/utilities/store";
	import { mount, onMount, unmount } from "svelte";
	import DayDetail from "./DayDetail.svelte";
	import DayHeader from "./DayHeader.svelte";
	import type { DayTransaction } from "./types";

	const { onClose } = $props<{ onClose: () => void }>();

	interface Transaction {
		id: string;
		date: string;
		payee: string;
		amount: number;
		category: string;
		account: string;
		notes: string;
		transfer_id?: string | null;
	}

	interface Payee {
		id: string;
		name: string;
		/** Set when the payee stands in for another account — i.e. the transaction is a transfer. */
		transfer_acct?: string | null;
	}

	interface Category {
		id: string;
		name: string;
	}

	interface Account {
		id: string;
		name: string;
		offbudget?: boolean;
	}

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

	interface DayTx {
		payee: string;
		amount: number;
		categoryId: string;
		categoryName: string;
		accountName: string;
		notes: string;
		upcoming?: boolean;
	}

	interface DayData {
		date: number;
		total: number;
		transactions: DayTx[];
		isToday: boolean;
		isCurrentMonth: boolean;
	}


	const HIDE_TRANSFERS_KEY = "spending-calendar-hide-transfers";
	const HIDE_OFFBUDGET_KEY = "spending-calendar-hide-offbudget";

	let year = $state(new Date().getFullYear());
	let month = $state(new Date().getMonth());
	let days = $state<DayData[]>([]);
	let loading = $state(true);
	let payeeMap = new Map<string, string>();
	let categoryMap = $state(new Map<string, string>());
	let accountMap = new Map<string, string>();
	/** Payees that represent the other side of a transfer, for rows without a `transfer_id` (schedules). */
	let transferPayees = new Set<string>();
	let offBudgetAccounts = new Set<string>();
	let hideTransfers = $state(true);
	let hideOffBudget = $state(true);
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

	function prevMonth() {
		if (month === 0) {
			month = 11;
			year--;
		} else month--;
		loadMonth();
	}

	function nextMonth() {
		if (month === 11) {
			month = 0;
			year++;
		} else month++;
		loadMonth();
	}

	function goToday() {
		const now = new Date();
		year = now.getFullYear();
		month = now.getMonth();
		loadMonth();
	}

	function formatAmount(cents: number): string {
		return fmtMoney(cents);
	}

	function formatAmountShort(cents: number): string {
		return fmtMoney(cents, { short: true });
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

	function isTransfer(t: Transaction): boolean {
		return Boolean(t.transfer_id) || (Boolean(t.payee) && transferPayees.has(t.payee));
	}

	async function setFilter(key: string, hidden: boolean) {
		if (key === HIDE_TRANSFERS_KEY) hideTransfers = hidden;
		else hideOffBudget = hidden;
		closeDayPanel();
		await setValue(key, hidden);
		loadMonth();
	}

	function dedupeTransactions(txs: DayTx[]): (DayTx & { count: number })[] {
		const map = new Map<string, DayTx & { count: number }>();
		for (const tx of txs) {
			const key = `${tx.payee}|${tx.upcoming ? "u" : "r"}`;
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
		loading = true;

		try {
			const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
			const endDay = new Date(year, month + 1, 0).getDate();
			const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

			const [transactions, schedules, payees, categories, accounts] = await Promise.all([
				query<Transaction[]>("transactions", {
					filter: { date: { $gte: startDate, $lte: endDate } },
				}),
				query<Schedule[]>("schedules"),
				payeeMap.size ? Promise.resolve(null) : query<Payee[]>("payees"),
				categoryMap.size ? Promise.resolve(null) : query<Category[]>("categories"),
				accountMap.size ? Promise.resolve(null) : query<Account[]>("accounts"),
			]);

			if (payees) {
				payeeMap = new Map(payees.map((p) => [p.id, p.name]));
				transferPayees = new Set(payees.filter((p) => p.transfer_acct).map((p) => p.id));
			}
			if (categories) {
				categoryMap = new Map(categories.map((c) => [c.id, c.name]));
			}
			if (accounts) {
				accountMap = new Map(accounts.map((a) => [a.id, a.name]));
				offBudgetAccounts = new Set(accounts.filter((a) => a.offbudget).map((a) => a.id));
			}

			const today = new Date();
			const firstDayOfWeek = new Date(year, month, 1).getDay();
			const daysInMonth = new Date(year, month + 1, 0).getDate();
			const daysInPrevMonth = new Date(year, month, 0).getDate();

			const byDay = new Map<number, DayTx[]>();
			for (const t of transactions) {
				if (!t.date) continue;
				if (hideTransfers && isTransfer(t)) continue;
				if (hideOffBudget && offBudgetAccounts.has(t.account)) continue;
				const day = parseInt(t.date.split("-")[2]);
				if (!byDay.has(day)) byDay.set(day, []);
				byDay.get(day)!.push({
					payee: payeeMap.get(t.payee) || "Unknown",
					amount: typeof t.amount === "number" ? t.amount : 0,
					categoryId: t.category || "",
					categoryName: categoryMap.get(t.category) || "",
					accountName: accountMap.get(t.account) || "",
					notes: t.notes || "",
				});
			}

			// Add upcoming schedules to the calendar
			for (const s of schedules) {
				if (s.completed || s.tombstone || !s.next_date) continue;
				if (hideTransfers && s._payee && transferPayees.has(s._payee)) continue;
				if (hideOffBudget && s._account && offBudgetAccounts.has(s._account)) continue;
				const [sy, sm, sd] = s.next_date.split("-").map(Number);
				if (sy !== year || sm !== month + 1) continue;
				if (!byDay.has(sd)) byDay.set(sd, []);
				const existing = byDay.get(sd)!;
				const payeeName = s.name || payeeMap.get(s._payee) || "Unknown";
				// Skip if a real transaction with the same payee already exists on this day
				if (existing.some((t) => !t.upcoming && t.payee === payeeName)) continue;
				existing.push({
					payee: payeeName,
					amount: parseScheduleAmount(s._amount),
					categoryId: "",
					categoryName: "",
					accountName: accountMap.get(s._account) || "",
					notes: "",
					upcoming: true,
				});
			}

			const grid: DayData[] = [];

			// Previous month padding
			for (let i = firstDayOfWeek - 1; i >= 0; i--) {
				grid.push({
					date: daysInPrevMonth - i,
					total: 0,
					transactions: [],
					isToday: false,
					isCurrentMonth: false,
				});
			}

			// Current month
			for (let d = 1; d <= daysInMonth; d++) {
				const txs = byDay.get(d) || [];
				const total = txs.reduce((sum, t) => sum + t.amount, 0);
				grid.push({
					date: d,
					total,
					transactions: txs,
					isToday: d === today.getDate() && month === today.getMonth() && year === today.getFullYear(),
					isCurrentMonth: true,
				});
			}

			// Next month padding
			const remaining = 7 - (grid.length % 7);
			if (remaining < 7) {
				for (let d = 1; d <= remaining; d++) {
					grid.push({
						date: d,
						total: 0,
						transactions: [],
						isToday: false,
						isCurrentMonth: false,
					});
				}
			}

			days = grid;
		} catch (e) {
			console.warn("[ABT Calendar]", e);
		} finally {
			loading = false;
		}
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
		if (!day.isCurrentMonth || day.transactions.length === 0) return;

		cleanupPanel();

		const date = new Date(year, month, day.date);
		const total = day.transactions.reduce((s, t) => s + t.amount, 0);

		headerContainer = document.createElement("div");
		headerInstance = mount(DayHeader, {
			target: headerContainer,
			props: {
				dateStr: date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" }),
				total,
			},
		});

		detailContainer = document.createElement("div");
		detailInstance = mount(DayDetail, {
			target: detailContainer,
			props: {
				date,
				transactions: day.transactions as DayTransaction[],
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
	}

	$effect(() => {
		if (!filtersOpen || !filterMenu || !filterButton) return;
		positionPopover(filterMenu, filterButton, { align: "right" });
		return onOutsideClick([filterMenu, filterButton], () => (filtersOpen = false));
	});

	onMount(() => {
		Promise.all([
			loadCurrency(),
			loadCategoryColors(),
			getValue(HIDE_TRANSFERS_KEY, true),
			getValue(HIDE_OFFBUDGET_KEY, true),
		]).then(([, , transfers, offBudget]) => {
			hideTransfers = Boolean(transfers);
			hideOffBudget = Boolean(offBudget);
			loadMonth();
		});

		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				if (filtersOpen) {
					filtersOpen = false;
					return;
				}
				closeDayPanel();
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			closeDayPanel();
		};
	});
</script>

<div class="cal-page">
	<div class="cal-header">
		<div class="cal-header__left">
			<h2 class="cal-title">{monthNames[month]} {year}</h2>
		</div>
		<div class="cal-header__right">
			<button
				class="cal-nav"
				class:is-active={filtersOpen}
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
					stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg
				>
			</button>
			<span class="cal-header__sep"></span>
			<button class="cal-nav" aria-label="Previous month" onclick={prevMonth}>
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
			<button class="cal-nav" aria-label="Next month" onclick={nextMonth} disabled={isAtCurrentMonth()}>
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

	{#if loading}
		<div class="cal-loading">Loading…</div>
	{:else}
		<div class="cal-grid" role="main">
			{#each dayNames as name}
				<div class="cal-day-name">{name}</div>
			{/each}

			{#each days as day, idx}
				{@const lastRow = days.length - 7}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role="button" and tabindex are set by the same condition -->
				<div
					class="cal-cell"
					class:is-today={day.isToday}
					class:is-muted={!day.isCurrentMonth}
					class:is-clickable={day.isCurrentMonth && day.transactions.length > 0}
					data-corner={idx === 0
						? "tl"
						: idx === 6
							? "tr"
							: idx === lastRow
								? "bl"
								: idx === days.length - 1
									? "br"
									: undefined}
					role={day.isCurrentMonth && day.transactions.length > 0 ? "button" : undefined}
					tabindex={day.isCurrentMonth && day.transactions.length > 0 ? 0 : undefined}
					onclick={() => openDayPanel(day)}
					onkeydown={(e) => {
						if (e.key === "Enter") openDayPanel(day);
					}}
				>
					<div class="cal-cell__header">
						<span class="cal-cell__date" class:is-today={day.isToday}>{day.date}</span>
						{#if day.total !== 0 && day.isCurrentMonth}
							<span
								class="cal-cell__total abt-privacy-number"
								class:is-neg={day.total < 0}
								class:is-pos={day.total > 0}
							>
								{formatAmountShort(day.total)}
							</span>
						{/if}
					</div>

					{#if day.isCurrentMonth && day.transactions.length > 0}
						{@const deduped = dedupeTransactions(day.transactions)}
						<div class="cal-cell__txs">
							{#each deduped.slice(0, 4) as tx}
								<div class="cal-tx" class:is-upcoming={tx.upcoming}>
									<span
										class="cal-tx__dot"
										style="background: {tx.upcoming
											? 'var(--color-pageTextSubdued)'
											: getCategoryColor(tx.categoryId)}"
									></span>
									<span class="cal-tx__payee abt-privacy-number">{tx.payee}</span>
									{#if tx.count > 1}
										<span class="cal-tx__count">×{tx.count}</span>
									{/if}
								</div>
							{/each}
							{#if deduped.length > 4}
								<div class="cal-tx cal-tx--more">+{deduped.length - 4} more</div>
							{/if}
						</div>

						<div class="cal-cell__bars">
							{#each Object.entries(day.transactions.reduce((acc, t) => {
										if (t.amount < 0) {
											acc[t.categoryId] = (acc[t.categoryId] || 0) + Math.abs(t.amount);
										}
										return acc;
									}, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]) as [catId, amount]}
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
	{/if}

	{#if filtersOpen}
		<div class="cal-filters" bind:this={filterMenu}>
			<div class="cal-filters__title">Show</div>
			<label class="cal-filters__row">
				<span>Transfers</span>
				<input
					type="checkbox"
					checked={!hideTransfers}
					onchange={(e) => setFilter(HIDE_TRANSFERS_KEY, !e.currentTarget.checked)}
				/>
			</label>
			<label class="cal-filters__row">
				<span>Off-budget accounts</span>
				<input
					type="checkbox"
					checked={!hideOffBudget}
					onchange={(e) => setFilter(HIDE_OFFBUDGET_KEY, !e.currentTarget.checked)}
				/>
			</label>
		</div>
	{/if}
</div>

<style>
	.cal-page {
		flex: 1;
		background: var(--color-pageBackground, #1a1b26);
		color: var(--color-pageText, #e0e0e0);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.cal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 24px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--color-tableBorder);
	}

	.cal-title {
		font-size: 25px;
		font-weight: 500;
		margin: 0;
	}

	.cal-header__left {
		display: flex;
		align-items: center;
		gap: 12px;
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
		border-radius: 6px;
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

	.cal-filters {
		position: fixed;
		z-index: 9999;
		min-width: 200px;
		padding: 4px;
		border: 1px solid var(--color-tableBorder);
		border-radius: 6px;
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
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

	.cal-filters__row input {
		accent-color: var(--color-sidebarItemAccentSelected);
		cursor: pointer;
		margin: 0;
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
		border-radius: 6px;
		background: none;
		color: var(--color-pageText);
		cursor: pointer;
		transition: background 0.1s;
	}

	.cal-today:hover:not(:disabled) {
		background: var(--color-tableRowBackgroundHover);
	}

	.cal-loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		opacity: 0.5;
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
		background: var(--color-pageBackground, #1a1b26);
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
		background: color-mix(in srgb, var(--color-pageText) 2%, var(--color-pageBackground));
	}

	.cal-cell.is-clickable {
		cursor: pointer;
	}

	.cal-cell.is-clickable:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 6%, transparent);
	}

	.cal-cell.is-muted {
		opacity: 0.5;
	}

	.cal-cell.is-today {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 6%, transparent);
	}

	.cal-cell__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 2px;
	}

	.cal-cell__date {
		font-size: 12px;
		font-weight: 500;
		opacity: 0.6;
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

	.cal-tx--more {
		font-size: 9px;
		opacity: 0.4;
		padding-left: 9px;
	}

	.cal-tx.is-upcoming {
		opacity: 0.45;
		font-style: italic;
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
