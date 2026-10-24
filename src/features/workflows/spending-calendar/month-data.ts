import type {
	Account,
	Category,
	CategoryGroup,
	Payee,
	Schedule,
	Transaction,
} from "@lib/types/actual-schema";
import { query, send } from "@lib/utilities/actual-api";
import { isoDate } from "@lib/utilities/months";
import { dailyBalances, projectSchedule, scheduleEffect } from "./balance";
import type { CalendarFilters } from "./filters";
import type { DayData, DayTransaction } from "./types";
import { createLogger } from "@lib/utilities/logger";

const log = createLogger("calendar");

export const MONTH_NAMES = [
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

/** How far ahead the month nav can go, so paging forward stays bounded. */
export const MAX_FUTURE_MONTHS = 12;

/** Months between the given month and the current one — negative for the past. */
export function monthsFromNow(year: number, month: number, now = new Date()): number {
	return (year - now.getFullYear()) * 12 + (month - now.getMonth());
}

export function hasTransactions(day: DayData): boolean {
	return day.isCurrentMonth && day.transactions.length > 0;
}

export function parseScheduleAmount(raw: unknown): number {
	if (typeof raw === "number") {
		return raw;
	}
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw);
			if (typeof parsed === "number") {
				return parsed;
			}
			if (parsed?.value != null) {
				return parsed.value;
			}
		} catch {
			return 0;
		}
	}
	if (raw && typeof raw === "object") {
		const obj = raw as Record<string, unknown>;
		if (typeof obj.value === "number") {
			return obj.value;
		}
	}
	return 0;
}

/**
 * Mirrors Actual's own paid-matching window (`getScheduleOccurrenceMatchStartDate`):
 * a manual schedule can be paid up to two days early, while an auto-posting or
 * fixed-date one always lands exactly on its date.
 */
export function occurrenceMatchStart(s: Schedule, occurrenceDate: string): string {
	if (s.posts_transaction || typeof s._date === "string") {
		return occurrenceDate;
	}
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
		log.warn("could not check schedule posting", s.id, e);
		return false;
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

/** Loads calendar months, caching the lookup tables and schedule expansions across loads. */
export function createMonthLoader() {
	let payeeNames = new Map<string, string>();
	let payeeTransferAcct = new Map<string, string | null>();
	let accountNames = new Map<string, string>();
	let accountOffbudget = new Map<string, boolean>();
	let accountList: Pick<Account, "id" | "name" | "offbudget" | "closed">[] = [];
	let categoryList: Pick<Category, "id" | "name" | "group" | "is_income">[] = [];
	let groupList: Pick<CategoryGroup, "id" | "name" | "is_income">[] = [];
	const categoryNames = new Map<string, string>();
	const incomeCategoryIds = new Set<string>();
	/** Expanded recurrence dates per schedule id, grown as the user pages further ahead. */
	const upcomingDates = new Map<string, { count: number; dates: string[] }>();

	/**
	 * A schedule only carries `next_date` — its single next occurrence — so a month
	 * further out would otherwise come up empty. Actual expands the recurrence rule
	 * itself (patterns, intervals, end conditions, weekend skipping), so ask it
	 * rather than reimplementing those rules here.
	 */
	async function loadUpcomingDates(s: Schedule, count: number): Promise<string[]> {
		const cached = upcomingDates.get(s.id);
		if (cached && cached.count >= count) {
			return cached.dates;
		}
		let dates: string[] = [];
		try {
			dates = await send<string[]>("schedule/get-upcoming-dates", { config: s._date, count });
		} catch (e) {
			log.warn("could not expand schedule", s.id, e);
		}
		upcomingDates.set(s.id, { count, dates });
		return dates;
	}

	async function load(
		year: number,
		month: number,
		{ filters, firstDayOfWeek = 0 }: { filters: CalendarFilters; firstDayOfWeek?: number },
	): Promise<DayData[]> {
		const hiddenAccounts = new Set(filters.hiddenAccounts);
		const hiddenCategories = new Set(filters.hiddenCategories);
		const isHidden = (account: string | null | undefined) =>
			!!account &&
			(hiddenAccounts.has(account) || (filters.hideOffBudget && !!accountOffbudget.get(account)));
		const inFlow = (amount: number) =>
			filters.flow === "all" || (filters.flow === "spending" ? amount < 0 : amount > 0);
		const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const startDate = `${monthPrefix}01`;
		const endDate = `${monthPrefix}${String(daysInMonth).padStart(2, "0")}`;

		const [transactions, schedules, payees, categories, groups, accounts] = await Promise.all([
			query<Transaction[]>("transactions", {
				filter: { $and: [{ date: { $gte: startDate } }, { date: { $lte: endDate } }] },
			}),
			filters.showScheduled ? query<Schedule[]>("schedules") : Promise.resolve([]),
			payeeNames.size ? Promise.resolve(null) : query<Payee[]>("payees"),
			categoryNames.size ? Promise.resolve(null) : query<Category[]>("categories"),
			groupList.length ? Promise.resolve(null) : query<CategoryGroup[]>("category_groups"),
			accountNames.size ? Promise.resolve(null) : query<Account[]>("accounts"),
		]);

		if (payees) {
			payeeNames = new Map(payees.map((p) => [p.id, p.name]));
			payeeTransferAcct = new Map(payees.map((p) => [p.id, p.transfer_acct ?? null]));
		}
		if (categories) {
			categoryList = categories
				.filter((c) => !c.tombstone)
				.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
			for (const c of categories) {
				categoryNames.set(c.id, c.name);
				if (c.is_income) {
					incomeCategoryIds.add(c.id);
				}
			}
		}
		if (groups) {
			// Income last, as Actual's budget page lists it.
			groupList = groups
				.filter((g) => !g.tombstone)
				.sort(
					(a, b) =>
						Number(a.is_income) - Number(b.is_income) || (a.sort_order ?? 0) - (b.sort_order ?? 0),
				);
		}
		if (accounts) {
			accountNames = new Map(accounts.map((a) => [a.id, a.name]));
			accountOffbudget = new Map(accounts.map((a) => [a.id, a.offbudget]));
			accountList = accounts.filter((a) => !a.tombstone);
		}

		// A transfer between two accounts with the same on/off-budget status is just money
		// moving between buckets. With both ends shown it nets out and is left off; with one
		// hidden, it's what moved the shown account's balance, so it's listed (as no spending).
		// One crossing the on/off-budget boundary acts like real spending or income.
		const transactionById = new Map(transactions.map((t) => [t.id, t]));
		function pureTransferAccount(t: Transaction): string | null {
			const other = t.transfer_id ? transactionById.get(t.transfer_id) : undefined;
			return other && isPure(t.account, other.account) ? other.account : null;
		}
		function pureTransferScheduleAccount(s: Schedule): string | null {
			const other = s._payee ? payeeTransferAcct.get(s._payee) : null;
			return other && isPure(s._account || "", other) ? other : null;
		}
		function isPure(from: string, to: string): boolean {
			const fromOff = accountOffbudget.get(from);
			const toOff = accountOffbudget.get(to);
			return fromOff != null && toOff != null && fromOff === toOff;
		}

		const byDay = new Map<number, DayTransaction[]>();
		for (const t of transactions) {
			const transferTo = pureTransferAccount(t);
			if (!t.date || (transferTo && !isHidden(transferTo))) {
				continue;
			}
			if (
				isHidden(t.account) ||
				(t.category && hiddenCategories.has(t.category)) ||
				!inFlow(t.amount ?? 0)
			) {
				continue;
			}
			const day = parseInt(t.date.split("-")[2]);
			if (!byDay.has(day)) {
				byDay.set(day, []);
			}
			byDay.get(day)!.push({
				payee: (t.payee && payeeNames.get(t.payee)) || "Unknown",
				amount: typeof t.amount === "number" ? t.amount : 0,
				categoryId: t.category || "",
				categoryName: (t.category && categoryNames.get(t.category)) || "",
				accountName: accountNames.get(t.account) || "",
				notes: t.notes || "",
				...(transferTo && { transfer: true }),
			});
		}

		// The end of each schedule the calendar shows: its own account, or for a transfer from a
		// hidden account, the shown one it pays into, where the amount runs the other way.
		const sides = new Map<string, { account: string | null; amount: number; from?: string }>();
		for (const s of schedules) {
			const amount = parseScheduleAmount(s._amount);
			const transferAcct = (s._payee && payeeTransferAcct.get(s._payee)) || null;
			const transferShown = !!transferAcct && !isHidden(transferAcct);
			if (!isHidden(s._account)) {
				if (!pureTransferScheduleAccount(s) || !transferShown) {
					sides.set(s.id, { account: s._account || null, amount });
				}
			} else if (transferShown) {
				sides.set(s.id, { account: transferAcct, amount: -amount, from: s._account || undefined });
			}
		}
		const visibleSchedules = schedules.filter((s) => {
			const side = sides.get(s.id);
			return !s.completed && !s.tombstone && !!side && inFlow(side.amount);
		});

		const todayIso = isoDate(new Date());
		// Only accounts the filter lists, so unticking them all leaves nothing behind (closed ones).
		const selected = new Set(
			accountList.filter((a) => !a.closed && !isHidden(a.id)).map((a) => a.id),
		);
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
			if (s.next_date?.startsWith(monthPrefix)) {
				addOccurrence(s.id, s.next_date);
			}
		}

		// `next_date` is only ever the *next* occurrence, so any month from the
		// current one onward needs the recurrence expanded to find the rest. The
		// expansion starts at today, so past days never gain projected entries.
		const monthsAhead = monthsFromNow(year, month);
		const count = Math.min((monthsAhead + 1) * 31 + 1, 400);
		if (monthsAhead >= 0) {
			await Promise.all(
				visibleSchedules.map(async (s) => {
					// A one-off schedule stores a plain date, not a recurrence to expand.
					if (!s._date || typeof s._date === "string") {
						return;
					}
					const dates = await loadUpcomingDates(s, count);
					for (const d of dates) {
						if (d.startsWith(monthPrefix)) {
							addOccurrence(s.id, d);
						}
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
					if (date >= todayIso) {
						return;
					}
					if (await wasOccurrencePosted(s, date)) {
						posted.add(`${s.id}|${date}`);
					}
				}),
			),
		);

		for (const s of visibleSchedules) {
			const dates = occurrences.get(s.id);
			if (!dates) {
				continue;
			}
			const side = sides.get(s.id)!;
			const payeeName =
				s.name ||
				(side.from ? accountNames.get(side.from) : s._payee && payeeNames.get(s._payee)) ||
				"Unknown";
			for (const date of dates) {
				if (posted.has(`${s.id}|${date}`)) {
					continue;
				}
				const sd = Number(date.slice(-2));
				if (!byDay.has(sd)) {
					byDay.set(sd, []);
				}
				const existing = byDay.get(sd)!;
				// Skip if a real transaction with the same payee already exists on this day
				if (existing.some((t) => !t.upcoming && !t.missed && t.payee === payeeName)) {
					continue;
				}
				existing.push({
					payee: payeeName,
					amount: side.amount,
					categoryId: "",
					categoryName: "",
					accountName: (side.account && accountNames.get(side.account)) || "",
					notes: "",
					scheduleId: s.id,
					...(pureTransferScheduleAccount(s) && { transfer: true }),
					...(date < todayIso ? { missed: true } : { upcoming: true }),
					...(filters.showBalance &&
						!s._account &&
						selected.size !== 1 &&
						date >= todayIso && { outsideBalance: true }),
				});
			}
		}

		let balances: Map<number, number> | null = null;
		if (filters.showBalance && selected.size) {
			const projected =
				monthsAhead >= 0
					? await Promise.all(
							schedules
								.filter((s) => !s.completed && !s.tombstone)
								.map(async (s) => {
									const transferAcct = (s._payee && payeeTransferAcct.get(s._payee)) || null;
									const effect = scheduleEffect(s, selected, transferAcct);
									if (!effect) {
										return [];
									}
									const dates =
										s._date && typeof s._date !== "string" ? await loadUpcomingDates(s, count) : [];
									return projectSchedule(s, dates, effect, todayIso, endDate);
								}),
						)
					: [];
			balances = await dailyBalances({
				accounts: selected,
				startDate,
				daysInMonth,
				transactions,
				projected: projected.flat(),
			});
		}

		return buildGrid(year, month, byDay, todayIso, firstDayOfWeek, balances);
	}

	return {
		load,
		categoryNames,
		incomeCategoryIds,
		accounts: () => accountList,
		categories: () => categoryList,
		/** Forgets schedule expansions and payees, after an edit may have changed either. */
		invalidate: () => {
			upcomingDates.clear();
			payeeNames = new Map();
		},
		/** Drops one of the lists kept between months, so the next load fetches it again. */
		forget: (scope: "accounts" | "categories" | "payees") => {
			if (scope === "accounts") {
				accountNames = new Map();
			} else if (scope === "categories") {
				categoryNames.clear();
				incomeCategoryIds.clear();
				groupList = [];
			} else {
				payeeNames = new Map();
			}
		},
		categoryGroups: () => groupList,
	};
}

/**
 * Lays a month's days out in full weeks starting on `firstDayOfWeek` (0 = Sunday), padded
 * with neighbouring days.
 */
export function buildGrid(
	year: number,
	month: number,
	byDay: Map<number, DayTransaction[]>,
	todayIso: string,
	firstDayOfWeek = 0,
	balances: Map<number, number> | null = null,
): DayData[] {
	const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
	const leading = (new Date(year, month, 1).getDay() - firstDayOfWeek + 7) % 7;
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const daysInPrevMonth = new Date(year, month, 0).getDate();
	const grid: DayData[] = [];

	for (let i = leading - 1; i >= 0; i--) {
		grid.push(paddingDay(new Date(year, month - 1, daysInPrevMonth - i)));
	}

	for (let d = 1; d <= daysInMonth; d++) {
		const txs = byDay.get(d) || [];
		const total = txs.reduce((sum, t) => sum + (t.missed ? 0 : t.amount), 0);
		const spent = txs.reduce(
			(sum, t) => sum + (!t.missed && !t.upcoming && !t.transfer && t.amount < 0 ? -t.amount : 0),
			0,
		);
		const iso = `${monthPrefix}${String(d).padStart(2, "0")}`;
		grid.push({
			date: d,
			iso,
			total,
			spent,
			transactions: txs,
			balance: balances?.get(d),
			balanceFlat: d > 1 && iso !== todayIso && balances?.get(d) === balances?.get(d - 1),
			hasMissed: txs.some((t) => t.missed),
			isToday: iso === todayIso,
			isFuture: iso > todayIso,
			isCurrentMonth: true,
		});
	}

	const remaining = 7 - (grid.length % 7);
	if (remaining < 7) {
		for (let d = 1; d <= remaining; d++) {
			grid.push(paddingDay(new Date(year, month + 1, d)));
		}
	}

	return grid;
}

/** Which outer corner of the grid a cell sits on, for rounding. */
export function cellCorner(idx: number, len: number): string | undefined {
	if (idx === 0) {
		return "tl";
	}
	if (idx === 6) {
		return "tr";
	}
	if (idx === len - 7) {
		return "bl";
	}
	if (idx === len - 1) {
		return "br";
	}
	return undefined;
}
