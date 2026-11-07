import { spawn, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

/**
 * Regenerates the guide screenshots: a throwaway Actual behind the sidecar, a seeded demo budget at
 * a fixed date, then each shot driven and annotated. Needs Docker and `pnpm build`.
 */

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "website/public/images/guides");
const ACTUAL_PORT = 5106;
const SIDECAR_PORT = 3105;
const BASE = `http://localhost:${SIDECAR_PORT}`;
const CONTAINER = "abt-docs-shots";
const IMAGE = `actualbudget/actual-server:${process.env.ACTUAL_TAG ?? "latest"}`;
const PASSWORD = "abt-docs-shots";
const TODAY = "2026-06-24";
const BUDGET_TABLE = '[data-testid="budget-table"]';

const SETTINGS = {
	"experimental-sidebar": true,
	"modern-reconcile": true,
	"account-icon-picker": true,
	"sidebar-search-enabled": true,
};

const CATEGORIES = {
	Bills: ["Rent", "Utilities", "Internet"],
	"Usual Expenses": ["Groceries", "Dining Out", "Transport", "Fun"],
};

const ACCOUNTS = [
	{ name: "Everyday Checking", emoji: "🏦" },
	{ name: "Emergency Savings", emoji: "🐷" },
	{ name: "Rewards Card", emoji: "💳" },
	{ name: "Brokerage", emoji: "📈", offBudget: true },
];

// [payee, category, cents, day of month]; every month from January to June.
const MONTHLY = [
	["Acme Payroll", "Income", 115000, 1],
	["Acme Payroll", "Income", 115000, 15],
	["Maple Street Rentals", "Rent", -145000, 2],
	["City Power", "Utilities", -8640, 8],
	["Fiberline", "Internet", -6000, 12],
	["Corner Market", "Groceries", -9264, 4],
	["Corner Market", "Groceries", -11237, 11],
	["Corner Market", "Groceries", -8418, 18],
	["Noodle House", "Dining Out", -3250, 9],
	["Metro Transit", "Transport", -7000, 3],
	["Cinema Nine", "Fun", -2800, 20],
];

const pad = (n) => String(n).padStart(2, "0");

function monthlyTransactions() {
	const rows = [];
	for (let month = 1; month <= 6; month++) {
		for (const [payee, category, amount, day] of MONTHLY) {
			const date = `2026-${pad(month)}-${pad(day)}`;
			if (date <= TODAY) {
				rows.push({ payee, category, amount, date, month });
			}
		}
	}
	return rows;
}

function waitForServer(url) {
	return new Promise((done, fail) => {
		let tries = 0;
		const check = async () => {
			try {
				await fetch(url);
				done();
			} catch {
				if (++tries > 90) {
					fail(new Error(`${url} didn't start`));
				} else {
					setTimeout(check, 1000);
				}
			}
		};
		void check();
	});
}

async function startStack() {
	execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore" });
	execSync(`docker run -d --rm --name ${CONTAINER} -p ${ACTUAL_PORT}:5006 ${IMAGE}`, {
		stdio: "ignore",
	});
	const sidecar = spawn("node", ["docker/server.js"], {
		cwd: ROOT,
		stdio: "ignore",
		env: {
			...process.env,
			PORT: String(SIDECAR_PORT),
			ACTUAL_ORIGIN: `http://localhost:${ACTUAL_PORT}`,
			ASSETS_DIR: resolve(ROOT, ".output/chrome-mv3"),
			PACKAGE_JSON_PATH: resolve(ROOT, "package.json"),
		},
	});
	await waitForServer(BASE);
	return () => {
		sidecar.kill();
		execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore" });
	};
}

async function createBudget(page) {
	await page.goto(BASE);
	const confirm = page.getByRole("textbox", { name: "Confirm password" });
	await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
	await confirm.fill(PASSWORD);
	await confirm.press("Enter");
	await page.getByRole("button", { name: "Sign in" }).waitFor();
	const signIn = page.locator('input[type="password"]');
	await signIn.fill(PASSWORD);
	await signIn.press("Enter");
	await page.getByRole("button", { name: "Start budgeting" }).click();
	await page.locator(BUDGET_TABLE).waitFor({ timeout: 30_000 });
	await page.waitForFunction(() => typeof window.$send === "function");
}

/** Everything goes through Actual's own handlers, so the budget is one Actual could have made. */
async function seedBudget(page) {
	const send = (name, args) =>
		page.evaluate(([name, args]) => window.$send(name, args), [name, args]);

	const { grouped } = await send("get-categories");
	const categoryIds = {};
	for (const group of grouped) {
		for (const category of group.categories) {
			categoryIds[category.name] = category.id;
		}
	}
	for (const [groupName, names] of Object.entries(CATEGORIES)) {
		const group = grouped.find((g) => g.name === groupName) ?? grouped.find((g) => !g.is_income);
		for (const name of names) {
			categoryIds[name] ??= await send("category-create", { name, groupId: group.id });
		}
	}

	const accountIds = {};
	for (const account of ACCOUNTS) {
		accountIds[account.name] = await send("account-create", {
			name: account.name,
			offBudget: !!account.offBudget,
		});
	}

	const payeeIds = {};
	const payee = async (name) => (payeeIds[name] ??= await send("payee-create", { name }));

	const checking = accountIds["Everyday Checking"];
	const added = [
		{
			id: randomUUID(),
			account: checking,
			date: "2026-01-01",
			amount: 420000,
			payee: await payee("Starting Balance"),
			category: categoryIds.Income,
			cleared: true,
			reconciled: true,
		},
	];
	for (const row of monthlyTransactions()) {
		const lastWeek = row.date >= "2026-06-15";
		added.push({
			id: randomUUID(),
			account: checking,
			date: row.date,
			amount: row.amount,
			payee: await payee(row.payee),
			category: categoryIds[row.category],
			cleared: !lastWeek,
			reconciled: row.month < 6,
		});
	}
	for (const [account, amount, name] of [
		["Emergency Savings", 1250000, "Starting Balance"],
		["Rewards Card", -34012, "Starting Balance"],
		["Brokerage", 2850000, "Starting Balance"],
	]) {
		added.push({
			id: randomUUID(),
			account: accountIds[account],
			date: "2026-01-01",
			amount,
			payee: await payee(name),
			category: account === "Brokerage" ? null : categoryIds.Income,
			cleared: true,
			reconciled: true,
		});
	}
	await send("transactions-batch-update", { added });

	await send("account-update", {
		id: checking,
		name: "Everyday Checking",
		last_reconciled: String(Date.parse("2026-05-31T12:00:00Z")),
	});
	return { accountIds };
}

async function applySettings(page, accountIds) {
	const icons = Object.fromEntries(
		ACCOUNTS.map((a) => [accountIds[a.name], { type: "emoji", value: a.emoji }]),
	);
	await page.evaluate(
		([settings, icons]) => {
			for (const [key, value] of Object.entries(settings)) {
				localStorage.setItem(`local:${key}`, JSON.stringify(value));
			}
			localStorage.setItem("local:abt-account-icons", JSON.stringify(icons));
		},
		[SETTINGS, icons],
	);
}

/** Numbered outlines drawn into the page, so they follow the real elements. */
async function annotate(page, marks) {
	const boxes = [];
	for (const mark of marks) {
		boxes.push(await page.locator(mark).first().boundingBox());
	}
	await page.evaluate((boxes) => {
		const layer = document.createElement("div");
		layer.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
		document.documentElement.append(layer);
		boxes.forEach((box, i) => {
			const gap = 4;
			const outline = document.createElement("div");
			outline.style.cssText = `position:absolute;left:${box.x - gap}px;top:${box.y - gap}px;
				width:${box.width + gap * 2}px;height:${box.height + gap * 2}px;
				border:2px solid var(--abt-accent);border-radius:8px`;
			const badge = document.createElement("div");
			badge.textContent = String(i + 1);
			badge.style.cssText = `position:absolute;left:-13px;top:-13px;width:24px;height:24px;
				border-radius:50%;background:var(--abt-accent);color:#11111b;font:600 13px/24px system-ui;
				text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
			outline.append(badge);
			layer.append(outline);
		});
	}, boxes);
}

async function shot(page, name) {
	const path = resolve(OUT, `${name}.png`);
	mkdirSync(dirname(path), { recursive: true });
	await page.screenshot({ path });
	console.log(`wrote ${path}`);
}

/** Actual greets a new budget with a toast that would sit over the panel. */
async function dismissWelcome(page) {
	const welcome = page.getByText("Welcome to Actual!");
	try {
		await welcome.waitFor({ timeout: 5000 });
		await page.getByRole("button", { name: "Close" }).first().click();
		await welcome.waitFor({ state: "hidden" });
	} catch {
		// Not every Actual version shows it.
	}
}

async function reconcileShot(page, { accountIds }) {
	await page.goto(`${BASE}/accounts/${accountIds["Everyday Checking"]}`);
	await dismissWelcome(page);
	const button = page.locator("[data-abt-reconcile] button, button[data-abt-reconcile]").first();
	await button.waitFor();
	await button.click();
	const statement = page.getByRole("textbox", { name: "Statement balance" });
	await statement.waitFor();
	await page.waitForFunction(
		() => Number(document.querySelector(".rp__big-input")?.value.replace(/,/g, "")) > 0,
	);
	// The bank has seen the payday and the groceries, but not the cinema trip.
	const cleared = Math.round(Number((await statement.inputValue()).replace(/,/g, "")) * 100);
	await statement.fill(((cleared + 115000 - 8418) / 100).toFixed(2));
	await page.getByRole("button", { name: "Start reconciling" }).click();
	await page.locator(".rp__list").waitFor();
	await page.waitForTimeout(1500);
	await annotate(page, [
		"[data-abt-reconcile]",
		".rp__hero",
		".rp__list",
		".rp__adjust .abt-btn",
		".rp__footer .abt-tone-accent",
	]);
	await shot(page, "reconcile");
}

const stop = await startStack();
const browser = await chromium.launch();
try {
	const context = await browser.newContext({
		viewport: { width: 1400, height: 860 },
		deviceScaleFactor: 2,
		colorScheme: "light",
	});
	const page = await context.newPage();
	await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
	await createBudget(page);
	const seeded = await seedBudget(page);
	await applySettings(page, seeded.accountIds);
	await page.reload();
	await page.waitForFunction(() => typeof window.$send === "function");
	await reconcileShot(page, seeded);
} finally {
	await browser.close();
	stop();
}
