import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

async function load(file) {
	const source = await readFile(
		new URL(`../src/features/workflows/loan-payoff/${file}`, import.meta.url),
		"utf8",
	);
	const module = new SourceTextModule(stripTypeScriptTypes(source));
	await module.link(() => {
		throw new Error(`${file} should have no imports`);
	});
	await module.evaluate();
	return module.namespace;
}

const {
	payoff,
	balances,
	history,
	progress,
	paymentStep,
	paymentToFinishBy,
	nextPayment,
	expectedInterest,
	accruedInterest,
} = await load("amortize.ts");
const { readLoan, writeLoan, removeLoan } = await load("note.ts");

const monthly = { rate: 0.06, dayCount: "monthly", payment: 30000, paymentDay: 1, interestDay: 1 };
const daily = {
	rate: 0.0514,
	dayCount: "act365",
	payment: 186000,
	paymentDay: 23,
	interestDay: 20,
};

test("a monthly loan follows the textbook schedule", () => {
	// $10,000 at 6% with $300 a month: 37 payments and about $967 of interest (n = 36.56).
	const result = payoff(1000000, monthly, "2026-01-15");
	assert.equal(result.payments, 37);
	assert.equal(result.month, "2029-02");
	assert.ok(Math.abs(result.interest - 96670) < 100, `interest was ${result.interest}`);
});

test("with no interest it is principal over payment", () => {
	const result = payoff(1000000, { ...monthly, rate: 0 }, "2026-01-15");
	assert.equal(result.payments, 34);
	assert.equal(result.interest, 0);
});

test("a payment that doesn't cover the interest never finishes", () => {
	// 6% of $10,000 is $50 a month.
	assert.equal(payoff(1000000, { ...monthly, payment: 5000 }, "2026-01-15"), null);
	assert.equal(payoff(1000000, { ...monthly, payment: 4000 }, "2026-01-15"), null);
	assert.equal(payoff(1000000, { ...daily, payment: 4000 }, "2026-01-15"), null);
	assert.equal(payoff(0, monthly, "2026-01-15"), null);
});

test("daily interest lands close to the monthly figure at the same rate", () => {
	const byDay = payoff(1000000, { ...monthly, dayCount: "act365" }, "2026-01-15");
	const byMonth = payoff(1000000, monthly, "2026-01-15");
	assert.equal(byDay.payments, byMonth.payments);
	// The first posting covers 17 days rather than a whole month, and the rest differ by days.
	const gap = byMonth.interest - byDay.interest;
	assert.ok(gap > 0 && gap < 5000, `gap was ${gap}`);
});

test("the last payment settles interest built up since the last posting", () => {
	// Paid off 3 days after a posting: those days' interest is owed too.
	const result = payoff(100000, { ...daily, payment: 200000 }, "2026-01-20");
	assert.equal(result.payments, 1);
	assert.equal(result.month, "2026-01");
	assert.equal(result.interest, Math.round((100000 * 0.0514 * 3) / 365));
});

test("a day the month doesn't have means its last day", () => {
	const result = payoff(
		50000,
		{ ...monthly, rate: 0, payment: 20000, paymentDay: 31 },
		"2026-01-31",
	);
	assert.equal(result.payments, 3);
	assert.equal(result.month, "2026-04");
});

test("an extra payment shortens the loan and saves interest", () => {
	const base = payoff(1000000, monthly, "2026-01-15");
	const extra = payoff(1000000, monthly, "2026-01-15", [{ month: "2026-06", amount: 200000 }]);
	assert.ok(extra.payments < base.payments);
	assert.ok(extra.interest < base.interest);
	// One that's already past goes with the next payment rather than being dropped.
	const late = payoff(1000000, { ...monthly, rate: 0 }, "2026-01-15", [
		{ month: "2025-11", amount: 400000 },
	]);
	assert.equal(late.payments, 20);
});

test("traces the balance month by month down to nothing", () => {
	const points = balances(1000000, monthly, "2026-01-15");
	const result = payoff(1000000, monthly, "2026-01-15");
	assert.deepEqual(points[0], { month: "2026-01", balance: 1000000 });
	assert.deepEqual(points.at(-1), { month: result.month, balance: 0 });
	assert.equal(points.length, result.payments + 1);
	for (let i = 1; i < points.length; i++) {
		assert.ok(points[i].balance < points[i - 1].balance);
		assert.ok(points[i].month > points[i - 1].month);
	}
	// A payment later in the start month updates that month rather than adding a second point.
	const sameMonth = balances(100000, { ...monthly, rate: 0, paymentDay: 20 }, "2026-01-15");
	assert.deepEqual(sameMonth[0], { month: "2026-01", balance: 70000 });
	assert.equal(balances(1000000, { ...monthly, payment: 4000 }, "2026-01-15"), null);
});

test("steps payments by about a tenth, to one figure", () => {
	assert.equal(paymentStep(186000), 20000);
	assert.equal(paymentStep(5000), 500);
	assert.equal(paymentStep(0), 0);
});

test("solves for the payment that finishes by a month", () => {
	for (const terms of [monthly, daily]) {
		const payment = paymentToFinishBy(5000000, terms, "2026-01-15", "2029-12");
		const at = payoff(5000000, { ...terms, payment }, "2026-01-15");
		assert.ok(at.month <= "2029-12");
		// A cent less takes longer.
		const under = payoff(5000000, { ...terms, payment: payment - 1 }, "2026-01-15");
		assert.ok(!under || under.month > "2029-12");
	}
	// No payment date falls before the end of a month that's already over.
	assert.equal(paymentToFinishBy(5000000, monthly, "2026-01-15", "2025-12"), null);
});

test("reads the loan line from a note", () => {
	const note =
		"Mortgage, renews 2028\nloan: rate=0.0514 daycount=act365 interestDay=20 payment=1860 paymentDay=23 interestPayee=RBC\nmore";
	assert.deepEqual(readLoan(note), {
		rate: 0.0514,
		daycount: "act365",
		interestDay: 20,
		payment: 1860,
		paymentDay: 23,
		interestPayee: "RBC",
	});
	assert.equal(readLoan("just a note"), null);
	assert.equal(readLoan(null), null);
	assert.deepEqual(readLoan("loan:"), {});
	assert.deepEqual(
		readLoan('Loan: rate=abc paymentDay=40 daycount=30/360 interestPayee="Royal Bank"'),
		{
			interestPayee: "Royal Bank",
		},
	);
});

test("writes the loan line without touching the rest of the note", () => {
	const config = {
		rate: 0.0499,
		daycount: "monthly",
		interestDay: 1,
		payment: 1900.5,
		paymentDay: 15,
	};
	assert.equal(
		writeLoan(null, config),
		"loan: rate=0.0499 daycount=monthly interestDay=1 payment=1900.5 paymentDay=15",
	);
	assert.equal(
		writeLoan("Renews 2028\n", config),
		"Renews 2028\nloan: rate=0.0499 daycount=monthly interestDay=1 payment=1900.5 paymentDay=15",
	);
	// Keys another tool put on the line are kept; a payee with a space is quoted.
	const before = "top\nloan: rate=0.05 lender=RBC payment=100\nbottom";
	const after = writeLoan(before, { ...config, interestPayee: "Royal Bank" });
	assert.equal(
		after,
		'top\nloan: rate=0.0499 daycount=monthly interestDay=1 payment=1900.5 paymentDay=15 interestPayee="Royal Bank" lender=RBC\nbottom',
	);
	assert.deepEqual(readLoan(after), { ...config, interestPayee: "Royal Bank" });
});

test("removes the loan line and nothing else", () => {
	assert.equal(removeLoan("top\nloan: rate=0.05 payment=100\nbottom"), "top\nbottom");
	assert.equal(removeLoan("loan: rate=0.05"), "");
	assert.equal(removeLoan("just a note"), "just a note");
	assert.equal(removeLoan(null), "");
});

test("expects the next daily interest charge from the balances since the last one", () => {
	// $36,500 owed throughout at 5%: $5 a day.
	const terms = { rate: 0.05, dayCount: "act365", interestDay: 20 };
	const rows = [{ date: "2026-11-20", amount: -15500, interest: true }];
	// Posted on the 20th already, so the next is December's: 30 days, 26 of them still to come.
	assert.deepEqual(expectedInterest(-3650000, rows, terms, "2026-11-24"), {
		date: "2026-12-20",
		amount: 15000,
		estimated: true,
	});
	// The day has arrived with nothing posted: the whole period is known.
	assert.deepEqual(expectedInterest(-3650000, rows, terms, "2026-12-21"), {
		date: "2026-12-20",
		amount: 15000,
		estimated: false,
	});
	// A payment part-way through lowers the days after it.
	const paid = [...rows, { date: "2026-12-05", amount: 1825000, interest: false }];
	assert.equal(expectedInterest(-1825000, paid, terms, "2026-12-21").amount, 15 * 500 + 15 * 250);
	// With no posting to start from, it covers the month before the interest day.
	assert.deepEqual(expectedInterest(-3650000, [], terms, "2026-11-24"), {
		date: "2026-12-20",
		amount: 15000,
		estimated: true,
	});
	assert.equal(expectedInterest(-3650000, [], terms, "2026-11-10").date, "2026-11-20");
	assert.equal(expectedInterest(5000, [], terms, "2026-11-24"), null);
});

test("expects a monthly charge as a twelfth of the rate on the balance", () => {
	const terms = { rate: 0.06, dayCount: "monthly", interestDay: 31 };
	const found = expectedInterest(-1000000, [], terms, "2026-02-10");
	assert.deepEqual(found, { date: "2026-02-28", amount: 5000, estimated: true });
});

test("walks the balance back to each earlier month's end", () => {
	const rows = [
		{ date: "2026-08-15", amount: -500000 },
		{ date: "2026-09-23", amount: 100000 },
		{ date: "2026-10-20", amount: -2000 },
		{ date: "2026-10-23", amount: 100000 },
		{ date: "2026-11-23", amount: 100000 },
	];
	// Owing 2,020 today; nothing was owed before August, so those months are left off.
	assert.deepEqual(history(-202000, rows, "2026-11-24", 6), [
		{ month: "2026-08", balance: 500000 },
		{ month: "2026-09", balance: 400000 },
		{ month: "2026-10", balance: 302000 },
	]);
	assert.deepEqual(history(-202000, rows, "2026-11-24", 1), [
		{ month: "2026-10", balance: 302000 },
	]);
	assert.deepEqual(history(-202000, rows, "2026-11-24", 0), []);
	// Across a year's end.
	assert.equal(history(-1000, [], "2027-01-05", 2)[0].month, "2026-11");
});

test("finds the day the next payment lands", () => {
	assert.equal(nextPayment("2026-11-24", 20), "2026-12-20");
	assert.equal(nextPayment("2026-11-24", 24), "2026-11-24");
	assert.equal(nextPayment("2026-11-24", 28), "2026-11-28");
	// A day the month doesn't have means its last, and December rolls into January.
	assert.equal(nextPayment("2027-02-10", 31), "2027-02-28");
	assert.equal(nextPayment("2026-12-15", 1), "2027-01-01");
});

test("measures the debt against the most it's been since it was last clear", () => {
	const rows = [
		// An earlier debt, cleared in May: it doesn't count.
		{ date: "2026-04-08", amount: -800000 },
		{ date: "2026-05-14", amount: 800000 },
		{ date: "2026-10-22", amount: -3381000 },
		{ date: "2026-11-01", amount: 54079 },
		{ date: "2026-11-20", amount: -13668 },
		{ date: "2026-11-23", amount: 100000 },
	];
	assert.deepEqual(progress(-3240589, rows), {
		peak: 3381000,
		paid: 140411,
		since: "2026-10-22",
	});
	// Interest can take it past what was borrowed; the peak is the most owed, not the first draw.
	const grown = [
		{ date: "2026-01-10", amount: -100000 },
		{ date: "2026-02-01", amount: -2000 },
		{ date: "2026-02-15", amount: 30000 },
	];
	assert.deepEqual(progress(-72000, grown), { peak: 102000, paid: 30000, since: "2026-01-10" });
	// Nothing paid yet, an opening balance older than the rows, and nothing owed.
	assert.equal(progress(-100000, [{ date: "2026-01-10", amount: -100000 }]).paid, 0);
	assert.deepEqual(progress(-90000, [{ date: "2026-03-01", amount: 10000 }]), {
		peak: 100000,
		paid: 10000,
		since: "2026-03-01",
	});
	assert.equal(progress(0, grown), null);
	assert.equal(progress(5000, grown), null);
});

test("carries daily interest built up since the last posting into the plan", () => {
	// 36,500 at 5%: five a day. Posted on the 20th; today is the 24th.
	const terms = { rate: 0.05, dayCount: "act365", interestDay: 20 };
	const rows = [{ date: "2026-11-20", amount: -15000, interest: true }];
	assert.equal(accruedInterest(-3650000, rows, terms, "2026-11-24"), 4 * 500);
	// With no posting to go by, from a month before the next one falls due.
	assert.equal(accruedInterest(-3650000, [], terms, "2026-11-24"), 4 * 500);
	// A payment part-way through counts the days before it at the higher balance.
	const paid = [...rows, { date: "2026-11-22", amount: 1825000, interest: false }];
	assert.equal(accruedInterest(-1825000, paid, terms, "2026-11-24"), 2 * 500 + 2 * 250);
	assert.equal(accruedInterest(-3650000, rows, { ...terms, dayCount: "monthly" }, "2026-11-24"), 0);

	// The plan then posts a whole month on the next interest day, as the lender will.
	const plan = { ...terms, payment: 3700000, paymentDay: 20 };
	const expected = expectedInterest(-3650000, rows, terms, "2026-11-24").amount;
	const bare = payoff(3650000, plan, "2026-11-24");
	const full = payoff(3650000, { ...plan, accrued: 2000 }, "2026-11-24");
	assert.equal(full.interest - bare.interest, 2000);
	assert.equal(full.interest, expected);
	// Monthly interest has no days to carry.
	const monthlyPlan = { ...plan, dayCount: "monthly" };
	assert.deepEqual(
		payoff(3650000, { ...monthlyPlan, accrued: 2000 }, "2026-11-24"),
		payoff(3650000, monthlyPlan, "2026-11-24"),
	);
});
