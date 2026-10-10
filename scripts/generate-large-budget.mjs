#!/usr/bin/env node
/*
 * Writes a large, made-up budget as a nYNAB export, for testing ABT on a budget the size of a
 * long-time user's. Import it in Actual with Import file → nYNAB, on a test server.
 *
 *   node scripts/generate-large-budget.mjs [--years=10] [--per-month=110] [--seed=1] [--out=path]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const [k, v] = a.replace(/^--/, "").split("=");
		return [k, v ?? "true"];
	}),
);
const YEARS = Number(args.years ?? 10);
const PER_MONTH = Number(args["per-month"] ?? 110);
const OUT = resolve(args.out ?? ".temp/large-budget.json");

// Seeded, so the same flags give the same budget.
let seed = Number(args.seed ?? 1) >>> 0;
function random() {
	seed = (seed + 0x6d2b79f5) >>> 0;
	let t = seed;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const uuid = () =>
	"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = Math.floor(random() * 16);
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
	});
// YNAB amounts are milliunits.
const dollars = (min, max) => int(min * 100, max * 100) * 10;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const start = new Date(today.getFullYear() - YEARS, today.getMonth() + 1, 1);
const months = [];
for (let d = new Date(start); d <= today; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
	months.push(d);
}
const dayIn = (month, day) => {
	const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
	const d = new Date(month.getFullYear(), month.getMonth(), Math.min(day, last));
	return d > today ? null : iso(d);
};

// ---- Accounts: 25 on budget (4 closed), 10 off budget.
const accounts = [];
const account = (name, onBudget, kind, closed = false) => {
	const a = { id: uuid(), name, on_budget: onBudget, closed, deleted: false, kind };
	accounts.push(a);
	return a;
};
const banks = ["Chase", "Ally", "Capital One", "Wells Fargo", "Schwab", "USAA"];
const checking = banks.map((b) => account(`${b} Checking`, true, "checking"));
const savings = banks.map((b) => account(`${b} Savings`, true, "savings"));
const cards = [
	"Amex Gold",
	"Chase Sapphire",
	"Discover It",
	"Citi Double",
	"Apple Card",
	"Costco Visa",
	"Target RedCard",
	"Amazon Prime Visa",
].map((n) => account(n, true, "card"));
account("Cash", true, "cash");
const closed = ["Old Credit Union", "Student Checking", "BofA Travel Card", "Simple"].map((n) =>
	account(n, true, "checking", true),
);
const offBudget = [
	"Vanguard 401k",
	"Fidelity Roth IRA",
	"Brokerage",
	"HSA",
	"529 Plan",
	"Mortgage",
	"Car Loan",
	"House",
	"Car",
	"Crypto",
].map((n) => account(n, false, "tracking"));
const spendFrom = [
	...checking.slice(0, 3),
	...cards,
	...cards.slice(0, 3),
	accounts.find((a) => a.kind === "cash"),
];

// ---- Categories: 20 groups, 120 categories, with Actual's internal and income groups.
const internal = { id: uuid(), name: "Internal Master Category", hidden: false, deleted: false };
const groups = [internal];
const categories = [];
const toAssign = {
	id: uuid(),
	category_group_id: internal.id,
	name: "Inflow: Ready to Assign",
	hidden: false,
	deleted: false,
};
categories.push(toAssign, {
	id: uuid(),
	category_group_id: internal.id,
	name: "Uncategorized",
	hidden: false,
	deleted: false,
});

const GROUPS = {
	Housing: ["Rent", "Mortgage Payment", "HOA", "Property Tax", "Home Insurance", "Repairs"],
	Utilities: ["Electric", "Gas", "Water", "Trash", "Internet", "Phone"],
	Food: ["Groceries", "Restaurants", "Coffee", "Takeout", "Work Lunch", "Snacks"],
	Transportation: [
		"Fuel",
		"Parking",
		"Tolls",
		"Transit",
		"Car Insurance",
		"Car Maintenance",
		"Registration",
	],
	Health: ["Doctor", "Dentist", "Pharmacy", "Vision", "Therapy", "Gym"],
	Personal: ["Haircut", "Clothing", "Toiletries", "Laundry", "Subscriptions"],
	Kids: ["Childcare", "School", "Activities", "Kids Clothing", "Allowance", "Toys"],
	Pets: ["Pet Food", "Vet", "Grooming", "Pet Insurance"],
	Entertainment: ["Movies", "Concerts", "Games", "Books", "Streaming", "Hobbies"],
	Travel: ["Flights", "Hotels", "Rental Cars", "Vacation Food", "Travel Insurance"],
	Gifts: ["Birthdays", "Holidays", "Weddings", "Charity", "Church"],
	Home: ["Furniture", "Decor", "Garden", "Cleaning Supplies", "Tools", "Appliances"],
	Education: ["Tuition", "Courses", "Student Loan", "Supplies"],
	Insurance: ["Life Insurance", "Umbrella", "Disability"],
	Debt: ["Car Payment", "Personal Loan", "Credit Card Interest"],
	Savings: [
		"Emergency Fund",
		"Vacation Fund",
		"New Car",
		"Home Projects",
		"Retirement Extra",
		"Investing",
	],
	Work: ["Office Supplies", "Software", "Conferences", "Professional Dues"],
	Taxes: ["Federal Tax", "State Tax", "Tax Prep"],
	Misc: ["Bank Fees", "Postage", "Cash Spending", "Miscellaneous", "Buffer"],
	"Annual Bills": [
		"Amazon Prime",
		"Costco Membership",
		"Domain Names",
		"Car Registration",
		"Software Licenses",
	],
};
let catCount = 0;
for (const [groupName, names] of Object.entries(GROUPS)) {
	const group = { id: uuid(), name: groupName, hidden: false, deleted: false };
	groups.push(group);
	for (const name of names) {
		catCount++;
		categories.push({
			id: uuid(),
			category_group_id: group.id,
			name,
			hidden: chance(0.04),
			deleted: false,
			// Monthly budget in milliunits; also what spending averages to.
			monthly: dollars(15, catCount % 9 === 0 ? 900 : 250),
			note: chance(0.4) ? `#template ${int(2, 40) * 10}` : null,
		});
	}
}
// Pad to 120 with extra spending categories, as long-lived budgets accumulate them.
const extra = { id: uuid(), name: "Legacy", hidden: false, deleted: false };
groups.push(extra);
for (let i = 1; catCount < 120; i++, catCount++) {
	categories.push({
		id: uuid(),
		category_group_id: extra.id,
		name: `Old Category ${i}`,
		hidden: chance(0.3),
		deleted: false,
		monthly: dollars(5, 60),
		note: null,
	});
}
const spending = categories.filter((c) => c.monthly);

// ---- Payees.
const PAYEES = [
	"Kroger",
	"Whole Foods",
	"Trader Joe's",
	"Costco",
	"Target",
	"Walmart",
	"Amazon",
	"Shell",
	"Chevron",
	"Starbucks",
	"Chipotle",
	"Netflix",
	"Spotify",
	"Comcast",
	"Verizon",
	"PG&E",
	"Home Depot",
	"Lowe's",
	"CVS",
	"Walgreens",
	"Uber",
	"Lyft",
	"Delta",
	"Marriott",
	"Airbnb",
	"Etsy",
	"Best Buy",
	"Apple",
	"Google",
	"Steam",
];
const payees = [];
const payee = (name) => {
	const p = { id: uuid(), name, deleted: false, transfer_account_id: null };
	payees.push(p);
	return p;
};
const employer = payee("Acme Corp Payroll");
const startingBalance = payee("Starting Balance");
const merchants = [];
for (let i = 0; i < 300; i++) {
	merchants.push(payee(i < PAYEES.length ? PAYEES[i] : `${pick(PAYEES)} #${int(100, 9999)}`));
}

// ---- Transactions.
const transactions = [];
const subtransactions = [];
const tx = (fields) => {
	const t = {
		id: uuid(),
		memo: null,
		cleared: "cleared",
		approved: true,
		deleted: false,
		category_id: null,
		payee_id: null,
		transfer_account_id: null,
		transfer_transaction_id: null,
		import_id: null,
		...fields,
	};
	transactions.push(t);
	return t;
};
const transfer = (from, to, amount, date, categoryId = null) => {
	const a = tx({
		account_id: from.id,
		date,
		amount: -amount,
		transfer_account_id: to.id,
		category_id: categoryId,
	});
	const b = tx({ account_id: to.id, date, amount, transfer_account_id: from.id });
	a.transfer_transaction_id = b.id;
	b.transfer_transaction_id = a.id;
};

const first = iso(months[0]);
for (const a of accounts) {
	if (a.kind === "card" || a.kind === "tracking") {
		continue;
	}
	tx({
		account_id: a.id,
		date: first,
		amount: dollars(500, 8000),
		payee_id: startingBalance.id,
		category_id: toAssign.id,
	});
}
for (const a of offBudget) {
	const debt = a.name.includes("Loan") || a.name === "Mortgage";
	tx({
		account_id: a.id,
		date: first,
		amount: debt ? -dollars(15000, 250000) : dollars(2000, 60000),
		payee_id: startingBalance.id,
	});
}

const recent = months.length - 3;
months.forEach((month, m) => {
	const closedAfter = m < months.length / 2;
	const main = checking[0];
	for (const day of [1, 15]) {
		const date = dayIn(month, day);
		if (date) {
			tx({
				account_id: main.id,
				date,
				amount: dollars(3200, 3600),
				payee_id: employer.id,
				category_id: toAssign.id,
				memo: "Paycheck",
			});
		}
	}
	for (let i = 0; i < PER_MONTH; i++) {
		const date = dayIn(month, int(1, 28));
		if (!date) {
			continue;
		}
		const from = closedAfter && chance(0.05) ? pick(closed) : pick(spendFrom);
		const cat = pick(spending);
		const amount = Math.max(1000, Math.round((cat.monthly / 4) * (0.3 + random() * 1.4)));
		const cleared =
			m >= recent && chance(0.3) ? "uncleared" : m < months.length - 12 ? "reconciled" : "cleared";
		// Older budgets keep a few uncategorized; the last months have more, waiting to be sorted.
		const uncategorized = chance(m >= recent ? 0.08 : 0.003);
		if (!uncategorized && chance(0.05)) {
			const parent = tx({
				account_id: from.id,
				date,
				amount: -amount,
				payee_id: pick(merchants).id,
				cleared,
				memo: "Split",
			});
			const a = Math.round(amount / 20) * 10;
			for (const [part, category] of [
				[a, cat],
				[amount - a, pick(spending)],
			]) {
				subtransactions.push({
					id: uuid(),
					transaction_id: parent.id,
					amount: -part,
					category_id: category.id,
					memo: null,
					deleted: false,
					transfer_account_id: null,
				});
			}
			continue;
		}
		tx({
			account_id: from.id,
			date,
			amount: -amount,
			payee_id: pick(merchants).id,
			category_id: uncategorized ? null : cat.id,
			cleared,
			memo: chance(0.1) ? "note" : null,
		});
	}
	const payday = dayIn(month, 20);
	if (payday) {
		for (const card of cards) {
			transfer(main, card, dollars(100, 900), payday);
		}
		transfer(main, savings[m % savings.length], dollars(200, 600), payday);
		transfer(
			main,
			offBudget[0],
			dollars(300, 500),
			payday,
			spending.find((c) => c.name === "Retirement Extra").id,
		);
		for (const a of offBudget.slice(0, 5)) {
			tx({
				account_id: a.id,
				date: payday,
				amount: dollars(-800, 1500),
				payee_id: null,
				memo: "Market change",
			});
		}
	}
});

// ---- Monthly budgets.
const ynabMonths = months.map((month) => ({
	month: iso(month),
	deleted: false,
	categories: spending.map((c) => ({
		id: c.id,
		category_group_id: c.category_group_id,
		budgeted: Math.round((c.monthly * (0.9 + random() * 0.2)) / 10) * 10,
		deleted: false,
	})),
}));

const budget = {
	budget_name: `ABT large test (${YEARS}y)`,
	accounts: accounts.map(({ kind: _kind, ...a }) => a),
	category_groups: groups,
	categories: categories.map(({ monthly: _monthly, ...c }) => c),
	payees,
	payee_locations: [],
	transactions,
	subtransactions,
	scheduled_transactions: [],
	scheduled_subtransactions: [],
	months: ynabMonths,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ data: { budget } }));
console.log(
	`${OUT}\n${accounts.length} accounts, ${catCount} categories in ${groups.length - 1} groups, ` +
		`${payees.length} payees, ${transactions.length} transactions + ${subtransactions.length} split lines, ${months.length} months`,
);
