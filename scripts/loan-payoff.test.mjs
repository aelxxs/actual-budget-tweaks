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

const { payoff, scenarios, scenarioStep, paymentToFinishBy, impliedRate } =
	await load("amortize.ts");
const { readLoan, writeLoan } = await load("note.ts");

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

test("scenarios run lowest payment first and drop one that isn't positive", () => {
	const rows = scenarios(1000000, monthly, "2026-01-15", 5000);
	assert.deepEqual(
		rows.map((r) => r.payment),
		[25000, 30000, 35000],
	);
	assert.ok(rows[0].payoff.payments > rows[1].payoff.payments);
	assert.ok(rows[1].payoff.interest > rows[2].payoff.interest);
	assert.equal(scenarios(1000000, monthly, "2026-01-15", 30000).length, 2);
	assert.equal(scenarios(1000000, monthly, "2026-01-15", 0).length, 1);
	assert.equal(scenarioStep(186000), 20000);
	assert.equal(scenarioStep(5000), 500);
	assert.equal(scenarioStep(0), 0);
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

test("works the rate back out of daily interest postings", () => {
	// $100,000 owed, 5% charged daily and posted on the 20th, $1,000 paid on the 23rd.
	const rows = [];
	let owed = 10000000;
	let accrued = 0;
	const day = new Date(Date.UTC(2026, 0, 1));
	const opening = -owed;
	for (let i = 0; i < 200; i++) {
		day.setUTCDate(day.getUTCDate() + 1);
		const date = day.toISOString().slice(0, 10);
		accrued += (owed * 0.05) / 365;
		if (day.getUTCDate() === 20) {
			const posted = Math.round(accrued);
			accrued = 0;
			owed += posted;
			rows.push({ date, amount: -posted, interest: true });
		}
		if (day.getUTCDate() === 23) {
			owed -= 100000;
			rows.push({ date, amount: 100000, interest: false });
		}
	}
	const found = impliedRate(-owed, rows, "act365");
	assert.equal(found.postings, 3);
	assert.ok(Math.abs(found.rate - 0.05) < 0.0002, `rate was ${found.rate}`);
	assert.ok(found.from < found.to);
	// The opening balance isn't needed: only rows since the first posting used.
	assert.ok(opening < 0);
});

test("works the rate back out of monthly interest postings", () => {
	const rows = [];
	let owed = 2000000;
	for (let month = 1; month <= 6; month++) {
		const posted = Math.round((owed * 0.072) / 12);
		owed += posted;
		rows.push({ date: `2026-0${month}-01`, amount: -posted, interest: true });
		owed -= 50000;
		rows.push({ date: `2026-0${month}-01`, amount: 50000, interest: false });
	}
	const found = impliedRate(-owed, rows, "monthly");
	assert.ok(Math.abs(found.rate - 0.072) < 0.001, `rate was ${found.rate}`);
});

test("gives no implied rate without two postings to measure between", () => {
	assert.equal(impliedRate(-100000, [], "act365"), null);
	assert.equal(
		impliedRate(-100000, [{ date: "2026-03-20", amount: -400, interest: true }], "act365"),
		null,
	);
	// Payments under the same payee aren't interest.
	assert.equal(
		impliedRate(
			-100000,
			[
				{ date: "2026-02-20", amount: 5000, interest: true },
				{ date: "2026-03-20", amount: 5000, interest: true },
			],
			"act365",
		),
		null,
	);
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
