/*
 * Loan arithmetic, in minor units (cents) and "YYYY-MM-DD" dates. No imports and no DOM, so the
 * unit test can load it as it is.
 */

/** How interest builds up: every day on that day's balance, or a twelfth of the rate once a month. */
export type DayCount = "act365" | "monthly";

export interface LoanTerms {
	/** Annual rate as a fraction: 0.0514 for 5.14%. */
	rate: number;
	dayCount: DayCount;
	/** The regular monthly payment. */
	payment: number;
	/** Day of the month the payment lands; a day the month doesn't have means its last day. */
	paymentDay: number;
	/** Day of the month interest is posted. */
	interestDay: number;
	/**
	 * Daily interest already built up since the last posting and not in the balance yet; it posts
	 * with the next one. See accruedInterest.
	 */
	accrued?: number;
}

/** A one-off payment on top of the regular one, made with that month's payment. */
export interface ExtraPayment {
	/** "YYYY-MM" */
	month: string;
	amount: number;
}

export interface Payoff {
	/** Regular payments made, the last one included. */
	payments: number;
	/** "YYYY-MM" of the last payment. */
	month: string;
	/** Interest charged from the start to the last payment. */
	interest: number;
}

/** Past this the debt counts as never paid off. */
const MAX_YEARS = 100;

const pad = (n: number): string => String(n).padStart(2, "0");

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseDate(date: string): [year: number, month: number, day: number] {
	const [y, m, d] = date.split("-").map(Number);
	return [y, m, d];
}

function dayNumber(date: string): number {
	const [y, m, d] = parseDate(date);
	return Math.round(Date.UTC(y, m - 1, d) / 86400e3);
}

function dateOf(day: number): string {
	const d = new Date(day * 86400e3);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Runs the loan forward from the day after `start`, owing `principal` then. Null when the
 * payment doesn't keep ahead of the interest, so the debt never clears.
 */
export function payoff(
	principal: number,
	terms: LoanTerms,
	start: string,
	extras: ExtraPayment[] = [],
	/** Called with what's still owed after each payment. */
	track?: (month: string, balance: number) => void,
): Payoff | null {
	if (!(principal > 0)) {
		return null;
	}
	const rate = Math.max(0, terms.rate);
	const pending = extras.filter((e) => e.amount > 0).sort((a, b) => a.month.localeCompare(b.month));

	let [year, month, day] = parseDate(start);
	let balance = principal;
	// Daily interest not yet posted; fractions of a cent carry until the posting.
	let accrued = terms.dayCount === "act365" ? Math.max(0, terms.accrued ?? 0) : 0;
	let interest = 0;
	let payments = 0;
	let yearAgo = Infinity;

	for (let months = 0; months <= MAX_YEARS * 12;) {
		day++;
		if (day > daysInMonth(year, month)) {
			day = 1;
			month++;
			months++;
			if (month > 12) {
				month = 1;
				year++;
			}
		}
		const last = daysInMonth(year, month);

		if (terms.dayCount === "act365") {
			accrued += (balance * rate) / 365;
		}
		if (day === Math.min(terms.interestDay, last)) {
			const posted = Math.round(terms.dayCount === "act365" ? accrued : (balance * rate) / 12);
			accrued = 0;
			balance += posted;
			interest += posted;
		}
		if (day === Math.min(terms.paymentDay, last)) {
			const key = `${year}-${pad(month)}`;
			let amount = terms.payment;
			while (pending.length && pending[0].month <= key) {
				amount += pending.shift()!.amount;
			}
			payments++;
			// The last payment also settles what has built up since the last posting.
			const owed = balance + Math.round(accrued);
			if (amount >= owed) {
				track?.(key, 0);
				return { payments, month: key, interest: interest + Math.round(accrued) };
			}
			balance -= amount;
			track?.(key, balance);
			// Months differ in length, so "is it shrinking" is asked a year apart.
			if (payments % 12 === 0 && !pending.length) {
				if (balance >= yearAgo) {
					return null;
				}
				yearAgo = balance;
			}
		}
	}
	return null;
}

export interface BalancePoint {
	/** "YYYY-MM" */
	month: string;
	balance: number;
}

/**
 * What's owed month by month, from `principal` in the start month down to nothing; a month with
 * no payment yet repeats the one before. Null when the debt never clears.
 */
export function balances(
	principal: number,
	terms: LoanTerms,
	start: string,
	extras: ExtraPayment[] = [],
): BalancePoint[] | null {
	const points: BalancePoint[] = [{ month: start.slice(0, 7), balance: principal }];
	const done = payoff(principal, terms, start, extras, (month, balance) => {
		const last = points[points.length - 1];
		if (last.month === month) {
			last.balance = balance;
		} else {
			points.push({ month, balance });
		}
	});
	return done ? points : null;
}

/**
 * What was owed at the end of each of the `months` months before today's, oldest first, walking
 * back from `balance`; months before there was a debt are left off. `balance` is the account's
 * balance with every row counted, and `rows` must reach back that far.
 */
export function history(
	balance: number,
	rows: { date: string; amount: number }[],
	today: string,
	months: number,
): BalancePoint[] {
	const [year, month] = parseDate(today);
	const points: BalancePoint[] = [];
	for (let back = 1; back <= months; back++) {
		const first = new Date(Date.UTC(year, month - 1 - back, 1));
		const key = `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}`;
		const since = rows.reduce(
			(sum, row) => (row.date.slice(0, 7) > key ? sum + row.amount : sum),
			0,
		);
		points.unshift({ month: key, balance: Math.max(0, since - balance) });
	}
	const start = points.findIndex((point) => point.balance > 0);
	return start === -1 ? [] : points.slice(start);
}

export interface Progress {
	/** The most that's been owed since the debt began. */
	peak: number;
	/** How far below that it is now. */
	paid: number;
	/** The day the debt began: the last one that started with nothing owed. "YYYY-MM-DD". */
	since: string;
}

/**
 * How far the debt has come down from the most it's been since the account last owed nothing,
 * by each day's closing balance. Null when nothing is owed. `balance` is the account's balance
 * with every row counted, and `rows` should be its whole history.
 */
export function progress(
	balance: number,
	rows: { date: string; amount: number }[],
): Progress | null {
	if (!(balance < 0)) {
		return null;
	}
	const moved = new Map<string, number>();
	for (const row of rows) {
		moved.set(row.date, (moved.get(row.date) ?? 0) + row.amount);
	}
	const days = [...moved.keys()].sort().reverse();
	let running = balance;
	let peak = -balance;
	let since = days[days.length - 1] ?? "";
	for (const day of days) {
		running -= moved.get(day) ?? 0;
		if (running >= 0) {
			since = day;
			break;
		}
		peak = Math.max(peak, -running);
	}
	return { peak, paid: peak + balance, since };
}

/** About a tenth of the payment, rounded to one figure: 200 for a payment of 1,860. */
export function scenarioStep(payment: number): number {
	const raw = payment / 10;
	if (!(raw >= 1)) {
		return 0;
	}
	const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
	return Math.round(raw / magnitude) * magnitude;
}

/** The smallest monthly payment that clears the debt by the end of `month`, or null if none can. */
export function paymentToFinishBy(
	principal: number,
	terms: LoanTerms,
	start: string,
	month: string,
	extras: ExtraPayment[] = [],
): number | null {
	const done = (payment: number): boolean => {
		const result = payoff(principal, { ...terms, payment }, start, extras);
		return !!result && result.month <= month;
	};
	// Enough to clear it at the first payment, whatever interest posts before then.
	let high = Math.ceil(principal * (1 + Math.max(0, terms.rate))) + 1;
	if (!done(high)) {
		return null;
	}
	let low = 0;
	while (high - low > 1) {
		const mid = Math.floor((low + high) / 2);
		if (done(mid)) {
			high = mid;
		} else {
			low = mid;
		}
	}
	return high;
}

/** The day the next payment lands, today's included: "YYYY-MM-DD". */
export function nextPayment(today: string, paymentDay: number): string {
	const [year, month, day] = parseDate(today);
	const on = (y: number, m: number): string => {
		const first = new Date(Date.UTC(y, m - 1, 1));
		const [fy, fm] = [first.getUTCFullYear(), first.getUTCMonth() + 1];
		return `${fy}-${pad(fm)}-${pad(Math.min(paymentDay, daysInMonth(fy, fm)))}`;
	};
	const thisMonth = on(year, month);
	return Number(thisMonth.slice(8)) >= day ? thisMonth : on(year, month + 1);
}

export interface LedgerRow {
	/** "YYYY-MM-DD" */
	date: string;
	/** As Actual stores it: negative adds to the debt. */
	amount: number;
	/** An interest charge, rather than a payment or a draw. */
	interest: boolean;
}

export interface ImpliedRate {
	/** Annual rate as a fraction. */
	rate: number;
	/** Interest postings it was worked out from. */
	postings: number;
	/** The first and last day of the balances behind it. */
	from: string;
	to: string;
}

/**
 * The rate the lender has actually been charging: each of the last `periods` interest postings
 * against the balance carried since the posting before it. `balance` is the account's balance
 * with every row in `rows` counted, and `rows` must reach back past the postings used.
 */
export function impliedRate(
	balance: number,
	rows: LedgerRow[],
	dayCount: DayCount,
	periods = 3,
): ImpliedRate | null {
	const charged = new Map<number, number>();
	const moved = new Map<number, number>();
	let latest = -Infinity;
	for (const row of rows) {
		const day = dayNumber(row.date);
		latest = Math.max(latest, day);
		moved.set(day, (moved.get(day) ?? 0) + row.amount);
		if (row.interest && row.amount < 0) {
			charged.set(day, (charged.get(day) ?? 0) - row.amount);
		}
	}
	// A posting needs the one before it to say which days it covers.
	const postings = [...charged.keys()].sort((a, b) => a - b).slice(-(periods + 1));
	if (postings.length < 2) {
		return null;
	}

	// What was owed at the end of each day, walking back from today's balance.
	const first = postings[0];
	const owedOn = new Map<number, number>();
	let running = balance;
	for (let day = latest; day >= first; day--) {
		owedOn.set(day, Math.max(0, -running));
		running -= moved.get(day) ?? 0;
	}

	let interest = 0;
	let balanceDays = 0;
	let averages = 0;
	for (let i = 1; i < postings.length; i++) {
		let sum = 0;
		for (let day = postings[i - 1]; day < postings[i]; day++) {
			sum += owedOn.get(day) ?? 0;
		}
		interest += charged.get(postings[i]) ?? 0;
		balanceDays += sum;
		averages += sum / (postings[i] - postings[i - 1]);
	}
	if (!(balanceDays > 0)) {
		return null;
	}
	return {
		rate: dayCount === "act365" ? (interest / balanceDays) * 365 : (interest / averages) * 12,
		postings: postings.length - 1,
		from: dateOf(first),
		to: dateOf(postings[postings.length - 1] - 1),
	};
}

export interface ExpectedInterest {
	/** The day it's due to post, "YYYY-MM-DD". */
	date: string;
	amount: number;
	/** True while days it covers are still to come, taken at today's balance. */
	estimated: boolean;
}

type InterestTerms = Pick<LoanTerms, "rate" | "dayCount" | "interestDay">;

/**
 * The stretch the next unposted interest charge covers, from the last posting (a month before it
 * falls due, when there's none) to the day it's due, with what was owed at the end of each day.
 */
function interestWindow(
	balance: number,
	rows: LedgerRow[],
	terms: InterestTerms,
	today: string,
): { from: number; due: number; now: number; owed: (day: number) => number } {
	const now = dayNumber(today);
	const moved = new Map<number, number>();
	let latest = now;
	let posted = -Infinity;
	for (const row of rows) {
		const day = dayNumber(row.date);
		latest = Math.max(latest, day);
		moved.set(day, (moved.get(day) ?? 0) + row.amount);
		if (row.interest && row.amount < 0) {
			posted = Math.max(posted, day);
		}
	}

	const [year, month] = parseDate(today);
	const interestDate = (y: number, m: number): number => {
		const first = new Date(Date.UTC(y, m - 1, 1));
		const [fy, fm] = [first.getUTCFullYear(), first.getUTCMonth() + 1];
		return dayNumber(`${fy}-${pad(fm)}-${pad(Math.min(terms.interestDay, daysInMonth(fy, fm)))}`);
	};
	// This month's, unless it's already in the ledger; with no postings to go by, the next to come.
	const current = interestDate(year, month);
	const known = Number.isFinite(posted);
	const due = (known ? posted >= current : current < now) ? interestDate(year, month + 1) : current;
	const [dueYear, dueMonth] = parseDate(dateOf(due));
	const from = known ? posted : interestDate(dueYear, dueMonth - 1);

	const owedOn = new Map<number, number>();
	let running = balance;
	for (let day = latest; day >= from; day--) {
		owedOn.set(day, Math.max(0, -running));
		running -= moved.get(day) ?? 0;
	}
	return { from, due, now, owed: (day) => owedOn.get(day) ?? Math.max(0, -balance) };
}

/**
 * The next interest charge that hasn't been posted: for the days since the last posting (a month,
 * when there's none) up to the next interest day. `balance` and `rows` are as for impliedRate.
 */
export function expectedInterest(
	balance: number,
	rows: LedgerRow[],
	terms: InterestTerms,
	today: string,
): ExpectedInterest | null {
	const { from, due, now, owed } = interestWindow(balance, rows, terms, today);
	const rate = Math.max(0, terms.rate);
	let amount = 0;
	if (terms.dayCount === "act365") {
		for (let day = from; day < due; day++) {
			amount += (owed(day) * rate) / 365;
		}
	} else {
		amount = (owed(due - 1) * rate) / 12;
	}
	amount = Math.round(amount);
	return amount > 0 ? { date: dateOf(due), amount, estimated: due - 1 > now } : null;
}

/**
 * Daily interest built up from the last posting to today that the balance doesn't hold yet, for
 * LoanTerms.accrued: without it a plan run from today's balance leaves those days out. Nothing
 * for monthly interest, which is charged whole on its day.
 */
export function accruedInterest(
	balance: number,
	rows: LedgerRow[],
	terms: InterestTerms,
	today: string,
): number {
	if (terms.dayCount !== "act365") {
		return 0;
	}
	const { from, now, owed } = interestWindow(balance, rows, terms, today);
	const rate = Math.max(0, terms.rate);
	let amount = 0;
	for (let day = from; day < now; day++) {
		amount += (owed(day) * rate) / 365;
	}
	return amount;
}
