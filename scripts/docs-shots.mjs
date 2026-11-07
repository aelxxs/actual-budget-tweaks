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
	"sidebar-shortcuts-enabled": true,
	"sidebar-group-totals": true,
	"experimental-sidebar-layout-mode": "standard",
};

const CATEGORIES = {
	Bills: ["Rent", "Utilities", "Internet"],
	"Usual Expenses": ["Groceries", "Dining Out", "Transport", "Fun"],
};

// `opening` and `monthly` are cents. Everyday Checking gets its history from MONTHLY below.
const ACCOUNTS = [
	{ name: "Everyday Checking", emoji: "🏦" },
	{ name: "Joint Checking", emoji: "👫", opening: 318240, monthly: 12500 },
	{
		name: "Rewards Card",
		emoji: "💳",
		group: "Credit Cards",
		opening: -34012,
		purchases: "everyday",
	},
	{ name: "Travel Card", emoji: "🛫", group: "Credit Cards", opening: -12875, purchases: "travel" },
	{ name: "Store Card", emoji: "🛍️", group: "Credit Cards", opening: -6150, purchases: "store" },
	{ name: "Emergency Savings", emoji: "⛈️", group: "Savings", opening: 1250000, monthly: 25000 },
	{ name: "Vacation Fund", emoji: "🏝️", group: "Savings", opening: 184000, monthly: 15000 },
	{ name: "New Car", emoji: "🚗", group: "Savings", opening: 320000, monthly: 20000 },
	{ name: "Home Repairs", emoji: "🔧", group: "Savings", opening: 96000, monthly: 10000 },
	{ name: "Brokerage", emoji: "📈", offBudget: true, opening: 2850000, monthly: 50000 },
	{ name: "Company RSUs", emoji: "🎁", offBudget: true, opening: 1842000 },
	{ name: "Roth IRA", emoji: "🌱", group: "Retirement", offBudget: true, opening: 3120000 },
	{ name: "401(k)", emoji: "🏛️", group: "Retirement", offBudget: true, opening: 8765000 },
	{ name: "HSA", emoji: "🩺", group: "Retirement", offBudget: true, opening: 642000 },
	{ name: "House", emoji: "🏡", offBudget: true, opening: 36500000 },
];

// [payee, category, cents, day of month]; amounts drift a little each month.
const PURCHASES = {
	everyday: [
		["Sunrise Coffee", "Dining Out", -645, 3],
		["Corner Market", "Groceries", -6418, 6],
		["Fuel Stop", "Transport", -4210, 9],
		["Bright Pharmacy", "Fun", -1875, 11],
		["Noodle House", "Dining Out", -2940, 14],
		["Bookshop on Main", "Fun", -2299, 17],
		["Sunrise Coffee", "Dining Out", -590, 19],
		["Corner Market", "Groceries", -5336, 22],
	],
	travel: [
		["Skyline Air", "Transport", -18420, 7],
		["Harbor Hotel", "Fun", -12900, 12],
		["City Rideshare", "Transport", -2360, 13],
	],
	store: [
		["Home Goods Depot", "Fun", -4875, 10],
		["Trailhead Outfitters", "Fun", -3650, 21],
	],
};

const TICKER = "ACME";
const tool = (url, label, icon, row) => ({
	id: url,
	label,
	icon,
	url,
	type: "tool",
	size: "small",
	row,
});
const SHORTCUTS = [
	{
		id: "rsu",
		label: `${TICKER} RSU`,
		icon: "svg:rsu",
		url: "rsu-tracker",
		type: "widget",
		size: "half",
		row: 0,
		config: { symbol: TICKER, startDate: "2025-03-03", count: "120" },
	},
	tool("calculator", "Calculator", "svg:calc", 0),
	{
		id: "stock",
		label: TICKER,
		icon: "svg:stock",
		url: "stock-tracker",
		type: "widget",
		size: "half",
		row: 1,
		config: { symbol: TICKER },
	},
	tool("currency-converter", "Currency Converter", "svg:convert", 1),
	tool("interest-calculator", "Interest Calculator", "svg:interest", 1),
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

	const groupIds = {};
	const groupSections = {};
	for (const account of ACCOUNTS.filter((a) => a.group)) {
		groupIds[account.group] ??= await send("account-group-create", { name: account.group });
		groupSections[groupIds[account.group]] = account.offBudget ? "offbudget" : "onbudget";
		await send("account-update", {
			id: accountIds[account.name],
			name: account.name,
			account_group_id: groupIds[account.group],
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
	for (const account of ACCOUNTS.filter((a) => a.opening)) {
		const category = (amount) => {
			if (account.offBudget) {
				return null;
			}
			return amount > 0 ? categoryIds.Income : categoryIds.Fun;
		};
		const row = (date, amount, name, extra) => ({
			id: randomUUID(),
			account: accountIds[account.name],
			date,
			amount,
			category: category(amount),
			cleared: true,
			reconciled: true,
			name,
			...extra,
		});
		const rows = [row("2026-01-01", account.opening, "Starting Balance")];
		if (account.monthly) {
			for (let month = 1; month <= 6; month++) {
				const name = account.monthly > 0 ? "Monthly Contribution" : "Card Purchases";
				rows.push(row(`2026-${pad(month)}-05`, account.monthly, name));
			}
		}
		for (const [name, categoryName, amount, day] of PURCHASES[account.purchases] ?? []) {
			for (let month = 1; month <= 6; month++) {
				const date = `2026-${pad(month)}-${pad(day)}`;
				if (date <= TODAY) {
					rows.push(
						row(date, amount - month * 37, name, {
							category: categoryIds[categoryName],
							reconciled: month < 6,
						}),
					);
				}
			}
		}
		for (const { name, ...rest } of rows) {
			added.push({ ...rest, payee: await payee(name) });
		}
	}
	await send("transactions-batch-update", { added });

	await send("account-update", {
		id: checking,
		name: "Everyday Checking",
		last_reconciled: String(Date.parse("2026-05-31T12:00:00Z")),
	});
	// Actual's own logo, served by the server under test.
	await send("preferences/save", {
		id: "abt:budget-icon",
		value: JSON.stringify({ type: "url", value: "/apple-touch-icon.png" }),
	});

	const { id: budgetId } = await send("load-prefs");
	return { accountIds, budgetId, groupSections };
}

async function applySettings(page, { accountIds, budgetId, groupSections }) {
	const icons = Object.fromEntries(
		ACCOUNTS.map((a) => [accountIds[a.name], { type: "emoji", value: a.emoji }]),
	);
	await page.evaluate(
		([settings, icons, shortcuts, budgetId, sections]) => {
			for (const [key, value] of Object.entries(settings)) {
				localStorage.setItem(`local:${key}`, JSON.stringify(value));
			}
			localStorage.setItem("local:abt-account-icons", JSON.stringify(icons));
			localStorage.setItem(`local:abt-sidebar-shortcuts:${budgetId}`, JSON.stringify(shortcuts));
			localStorage.setItem(
				`local:experimental-sidebar-group-sections:${budgetId}`,
				JSON.stringify(sections),
			);
		},
		[SETTINGS, icons, SHORTCUTS, budgetId, groupSections],
	);
}

/** Numbered outlines drawn into the page, so they follow the real elements. */
async function annotate(page, marks) {
	const boxes = [];
	for (const mark of marks) {
		const { selector, side } = typeof mark === "string" ? { selector: mark } : mark;
		boxes.push({ ...(await page.locator(selector).first().boundingBox()), side });
	}
	await page.evaluate((boxes) => {
		document.querySelector("[data-docs-marks]")?.remove();
		const layer = document.createElement("div");
		layer.setAttribute("data-docs-marks", "");
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
			const left =
				box.side === "right" ? box.width + gap * 2 - 13 : Math.max(-13, 2 - (box.x - gap));
			const top = Math.max(-13, 2 - (box.y - gap));
			badge.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:24px;height:24px;
				border-radius:50%;background:var(--abt-accent);color:#11111b;font:600 13px/24px system-ui;
				text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
			outline.append(badge);
			layer.append(outline);
		});
	}, boxes);
}

/** The whole page, or a crop around `around` with room for the callouts' badges. */
async function shot(page, name, around, { room = 24, width, height, cutout = false } = {}) {
	const path = resolve(OUT, `${name}.png`);
	mkdirSync(dirname(path), { recursive: true });
	let clip;
	if (around) {
		const box = await page.locator(around).boundingBox();
		clip = {
			x: box.x - room,
			y: box.y - room,
			width: width ?? box.width + room * 2,
			height: height ?? box.height + room * 2,
		};
	}
	// A cutout hides everything but the element, so the page can stage it on its own background.
	const style = cutout
		? await page.addStyleTag({
				content: `* { visibility: hidden !important; }
					${around}, ${around} * { visibility: visible !important; }
					html, body { background: transparent !important; }`,
			})
		: null;
	await page.screenshot({ path, clip, omitBackground: cutout });
	await style?.evaluate((el) => el.remove());
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

async function paletteShots(page) {
	await page.goto(`${BASE}/budget`);
	await page.locator(BUDGET_TABLE).waitFor();
	await page.waitForFunction(() => document.querySelector("[data-abt-live-sidebar]"));
	await page.waitForTimeout(1000);
	await page.keyboard.press("Control+k");
	const input = page.locator(".cp-input");
	await input.waitFor();
	await page.waitForTimeout(600);
	await annotate(page, [".cp-search", ".cp-item", ".cp-foot"]);
	await shot(page, "palette", ".cp");

	await input.fill("145.20 * 12");
	await page.waitForTimeout(400);
	await annotate(page, []);
	await shot(page, "palette-math", ".cp");

	await input.fill("reconcile");
	await page.waitForTimeout(400);
	await annotate(page, [".cp-item", ".cp-state"]);
	await shot(page, "palette-tweaks", ".cp");
}

async function sidebarShots(page) {
	const sidebar = "[data-abt-live-sidebar]";
	const open = async () => {
		await page.goto(`${BASE}/budget`);
		await page.locator(BUDGET_TABLE).waitFor();
		await page.locator(sidebar).waitFor();
		await page.waitForTimeout(1500);
	};

	// Tall enough for every account and the footer, in both layouts.
	await page.setViewportSize({ width: 1400, height: 980 });
	await open();
	await shot(page, "sidebar-standard", sidebar, { room: 0 });

	await page.locator(".account", { hasText: "Everyday Checking" }).hover();
	await page.locator(".acard").waitFor();
	await page.waitForTimeout(800);
	await shot(page, "sidebar-hover", ".acard", { room: 0, cutout: true });
	await page.mouse.move(700, 500);

	await page.keyboard.press("Control+k");
	await page.locator(".cp-input").fill("sidebar settings");
	await page.keyboard.press("Enter");
	const dialog = ".settings-dialog";
	await page.locator(dialog).waitFor();
	const tab = (name) =>
		page
			.locator(`${dialog} .abt-tabs button, ${dialog} [role="tab"], ${dialog} button`)
			.filter({ hasText: name })
			.first();
	await tab("Shortcuts").click();
	await page.waitForTimeout(800);
	await shot(page, "sidebar-shortcuts", dialog, { room: 0, cutout: true });
	await tab("Groups").click();
	await page.waitForTimeout(800);
	await shot(page, "sidebar-groups", dialog, { room: 0, height: 315, cutout: true });
	await page.keyboard.press("Escape");
	await page.waitForTimeout(400);

	// Live, since settings sync would restore the stored layout on a reload.
	await page.mouse.move(700, 500);
	await page.evaluate(() =>
		window.browser.storage.local.set({ "local:experimental-sidebar-layout-mode": "split" }),
	);
	await page.waitForTimeout(1200);
	await shot(page, "sidebar-split", sidebar, { room: 0 });

	await page.locator(".rail-foot .rail-icon").last().click();
	await page.locator('[aria-label="Collapse Savings"]').click();
	await page.locator('[aria-label="Collapse Retirement"]').click();
	await page.locator('[aria-label="Rewards Card"]').click();
	await page.mouse.move(1000, 30);
	await page.waitForTimeout(1500);
	await shot(page, "sidebar-rail", sidebar, { room: 0, width: 640, height: 830 });
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
	// Fixed prices, so the stock tiles don't change between runs.
	await page.route("**/abt-api/yahoo-chart/**", (route) => {
		const grant = route.request().url().includes("period1");
		return route.fulfill({
			json: {
				chart: {
					result: [
						{
							meta: { regularMarketPrice: 184.32, chartPreviousClose: 181.1 },
							indicators: { quote: [{ close: [grant ? 142.5 : 184.32] }] },
						},
					],
				},
			},
		});
	});
	await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
	await createBudget(page);
	const seeded = await seedBudget(page);
	await applySettings(page, seeded);
	await page.reload();
	await page.waitForFunction(() => typeof window.$send === "function");
	await reconcileShot(page, seeded);
	await paletteShots(page);
	await sidebarShots(page);
} finally {
	await browser.close();
	stop();
}
