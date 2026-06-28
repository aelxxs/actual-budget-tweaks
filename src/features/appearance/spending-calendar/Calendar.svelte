<script lang="ts">
	import { query } from "@lib/utilities/actual-api";
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
	}

	interface Payee {
		id: string;
		name: string;
	}

	interface Category {
		id: string;
		name: string;
	}

	interface Account {
		id: string;
		name: string;
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

	const CATEGORY_COLORS = [
		"#7c5cbf",
		"#3b82f6",
		"#10b981",
		"#f59e0b",
		"#ef4444",
		"#ec4899",
		"#0ea5e9",
		"#a855f7",
		"#14b8a6",
		"#f97316",
		"#8b5cf6",
		"#06b6d4",
		"#84cc16",
		"#e11d48",
		"#6366f1",
	];

	let year = $state(new Date().getFullYear());
	let month = $state(new Date().getMonth());
	let days = $state<DayData[]>([]);
	let loading = $state(true);
	let payeeMap = new Map<string, string>();
	let categoryMap = $state(new Map<string, string>());
	let accountMap = new Map<string, string>();
	let categoryColorMap = new Map<string, string>();
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
		const abs = Math.abs(cents) / 100;
		const prefix = cents < 0 ? "-" : "";
		return prefix + "$" + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function formatAmountShort(cents: number): string {
		const abs = Math.abs(cents) / 100;
		if (abs >= 1000) return "-$" + (abs / 1000).toFixed(1) + "k";
		return "-$" + abs.toFixed(0);
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

	function getCategoryColor(categoryId: string): string {
		if (!categoryId) return "#666";
		if (categoryColorMap.has(categoryId)) return categoryColorMap.get(categoryId)!;
		const idx = categoryColorMap.size % CATEGORY_COLORS.length;
		const color = CATEGORY_COLORS[idx];
		categoryColorMap.set(categoryId, color);
		return color;
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
			}
			if (categories) {
				categoryMap = new Map(categories.map((c) => [c.id, c.name]));
			}
			if (accounts) {
				accountMap = new Map(accounts.map((a) => [a.id, a.name]));
			}

			const today = new Date();
			const firstDayOfWeek = new Date(year, month, 1).getDay();
			const daysInMonth = new Date(year, month + 1, 0).getDate();
			const daysInPrevMonth = new Date(year, month, 0).getDate();

			const byDay = new Map<number, DayTx[]>();
			for (const t of transactions) {
				if (!t.date) continue;
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

	function getRelativeDate(d: Date): string {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
		if (diff === 0) return "Today";
		if (diff === 1) return "Yesterday";
		if (diff === -1) return "Tomorrow";
		if (diff > 0) {
			if (diff < 7) return `${diff} days ago`;
			const weeks = Math.floor(diff / 7);
			const days = diff % 7;
			let s = `${weeks} week${weeks > 1 ? "s" : ""}`;
			if (days > 0) s += `, ${days} day${days > 1 ? "s" : ""}`;
			return s + " ago";
		}
		return `in ${Math.abs(diff)} day${Math.abs(diff) > 1 ? "s" : ""}`;
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
				relativeDate: getRelativeDate(date),
				itemCount: day.transactions.length,
				total,
			},
		});

		detailContainer = document.createElement("div");
		detailInstance = mount(DayDetail, {
			target: detailContainer,
			props: {
				date,
				transactions: day.transactions as DayTransaction[],
				categoryColors: categoryColorMap,
			},
		});

		document.dispatchEvent(
			new CustomEvent("abt:sidepanel:open", {
				detail: {
					title: `${monthNames[month]} ${day.date}`,
					bodyNode: detailContainer,
					headerNode: headerContainer,
				},
			}),
		);
	}

	function closeDayPanel() {
		document.dispatchEvent(new CustomEvent("abt:sidepanel:close"));
		cleanupPanel();
	}

	onMount(() => {
		loadMonth();

		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
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
			<button class="cal-nav" onclick={prevMonth}>
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
			<button class="cal-nav" onclick={nextMonth} disabled={isAtCurrentMonth()}>
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
						<div class="cal-cell__txs">
							{#each day.transactions.slice(0, 4) as tx}
								<div class="cal-tx" class:is-upcoming={tx.upcoming}>
									<span
										class="cal-tx__dot"
										style="background: {tx.upcoming
											? 'var(--color-pageTextSubdued)'
											: getCategoryColor(tx.categoryId)}"
									></span>
									<span class="cal-tx__payee abt-privacy-number">{tx.payee}</span>
								</div>
							{/each}
							{#if day.transactions.length > 4}
								<div class="cal-tx cal-tx--more">+{day.transactions.length - 4} more</div>
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
		width: 3px;
		height: 3px;
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
