import { spawn, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

/**
 * Regenerates the guide screenshots: a throwaway Actual behind the sidecar, a seeded demo budget at
 * a fixed date, then each shot driven and annotated. Needs Docker and `pnpm build`.
 *
 * `--home` makes the home page's hero comparison instead, and `--readme` the README's screenshots.
 */

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "website/public/images/guides");
const ACTUAL_PORT = 5106;
const SIDECAR_PORT = 3105;
const BASE = `http://localhost:${SIDECAR_PORT}`;
const CONTAINER = "abt-docs-shots";
const IMAGE = `actualbudget/actual-server:${process.env.ACTUAL_TAG ?? "latest"}`;
const PASSWORD = "abt-docs-shots";
const HERO = resolve(ROOT, "website/public/images");
const README_IMAGES = resolve(ROOT, "images");
const TODAY = "2026-06-24";
const BUDGET_TABLE = '[data-testid="budget-table"]';

const SETTINGS = {
	"experimental-sidebar": true,
	"modern-reconcile": true,
	"account-icon-picker": true,
	"sidebar-search-enabled": true,
	"sidebar-shortcuts-enabled": true,
	"sidebar-group-totals": true,
	"actual-template-apply-breakdown": true,
	"experimental-sidebar-layout-mode": "standard",
	"transaction-inspector": true,
};

const HOME_SETTINGS = {
	...SETTINGS,
	"experimental-sidebar-layout-mode": "split",
	"side-panel-width": 280,
	"budget-summary-row": true,
	"category-progress-indicators": true,
	"balance-status-pills": true,
};

const README_SETTINGS = {
	...HOME_SETTINGS,
	"budget-month-header": true,
	"budget-category-filter": true,
	"spending-calendar-enabled": true,
};

const TEMPLATES = {
	Rent: ["#template 1450", 145000],
	"Renters Insurance": ["#template 18", 1800],
	Utilities: ["#template-1 90", 9000],
	Internet: ["#template-1 60", 6000],
	Groceries: ["#template-2 450", 45000],
	Transport: ["#template-2 160", 16000],
	"Dining Out": ["#template-3 150", 15000],
	Subscriptions: ["#template-3 16", 1600],
	Fun: ["#template-4 60", 6000],
	Shopping: ["#template-4 150", 15000],
	Vacation: ["#template-4 320", 32000],
	"Emergency Fund": ["#template-4 100", 10000],
	Gifts: ["#template-4 40", 4000],
};

// Listed top to bottom. Actual puts a new category first, and keeps the emoji in the name.
const CATEGORIES = {
	Needs: {
		Rent: "🏠",
		"Renters Insurance": "🛡️",
		Utilities: "💡",
		Groceries: "🥑",
		Transport: "🚆",
		Internet: "📶",
	},
	Wants: { "Dining Out": "🍜", Fun: "🍿", Shopping: "🛒", Subscriptions: "📺" },
	Saving: { Savings: "💵", Vacation: "✈️", "Emergency Fund": "⛺", Gifts: "🎁" },
};
const INCOME = { Income: "💰", "Starting Balances": "🏁" };

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
		["Bright Pharmacy", "Shopping", -1875, 11],
		["Noodle House", "Dining Out", -2940, 14],
		["Bookshop on Main", "Shopping", -2299, 17],
		["Sunrise Coffee", "Dining Out", -590, 19],
		["Corner Market", "Groceries", -5336, 22],
	],
	travel: [
		["Skyline Air", "Vacation", -18420, 7],
		["Harbor Hotel", "Vacation", -12900, 12],
		["City Rideshare", "Transport", -2360, 13],
	],
	store: [
		["Home Goods Depot", "Shopping", -4875, 10],
		["Trailhead Outfitters", "Shopping", -3650, 21],
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
	["Harbor Mutual", "Renters Insurance", -1800, 3],
	["City Power", "Utilities", -8640, 8],
	["StreamBox", "Subscriptions", -1599, 6],
	["Fiberline", "Internet", -6000, 12],
	["Corner Market", "Groceries", -9264, 4],
	["Corner Market", "Groceries", -11237, 11],
	["Corner Market", "Groceries", -8418, 18],
	["Noodle House", "Dining Out", -3250, 9],
	["Metro Transit", "Transport", -7000, 3],
	["Cinema Nine", "Fun", -2800, 20],
];

// What a bank would send on the last day: [account, payee, cents, date]. The Corner Market charge
// on the 22nd is already in the budget, so the import matches it.
const IMPORT = [
	["Rewards Card", "Sunrise Coffee", -645, "2026-06-24"],
	["Rewards Card", "Corner Market", -7126, "2026-06-23"],
	["Rewards Card", "Corner Market", -5558, "2026-06-22"],
	["Rewards Card", "Garden Center", -3840, "2026-06-23"],
	["Rewards Card", "Lakeside Vet", -8900, "2026-06-22"],
	["Everyday Checking", "Fuel Stop", -4380, "2026-06-23"],
	["Everyday Checking", "Acme Expenses", 4200, "2026-06-23"],
	["Travel Card", "City Rideshare", -1840, "2026-06-24"],
];

// Payees that always land in one category, as rules. Added after the earlier shots are taken.
const RULES = {
	"City Power": "Utilities",
	"Corner Market": "Groceries",
	"Sunrise Coffee": "Dining Out",
	"Fuel Stop": "Transport",
};

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
	for (const [groupName, categories] of Object.entries(CATEGORIES)) {
		const groupId = await send("category-group-create", { name: groupName });
		for (const [name, emoji] of Object.entries(categories).reverse()) {
			const label = `${emoji} ${name}`;
			if (categoryIds[name]) {
				await send("category-update", { id: categoryIds[name], name: label });
				await send("category-move", { id: categoryIds[name], groupId, targetId: null });
			} else {
				categoryIds[name] = await send("category-create", { name: label, groupId });
			}
		}
	}
	for (const [name, emoji] of Object.entries(INCOME)) {
		await send("category-update", { id: categoryIds[name], name: `${emoji} ${name}` });
	}
	// Actual's starter budget, now empty apart from what was moved out above.
	for (const group of grouped.filter((g) => !g.is_income)) {
		for (const category of group.categories) {
			if (category.name !== "Savings") {
				await send("category-delete", { id: category.id });
			}
		}
		await send("category-group-delete", { id: group.id });
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
		const rows = [row("2025-12-01", account.opening, "Starting Balance")];
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
	for (const [name, [note, amount]] of Object.entries(TEMPLATES)) {
		await send("notes-save", { id: categoryIds[name], note });
		for (let month = 1; month <= 5; month++) {
			await send("budget/budget-amount", {
				month: `2026-${pad(month)}`,
				category: categoryIds[name],
				amount,
			});
		}
	}

	// The opening balances count as income: most of it sits in savings, leaving June short.
	await send("budget/budget-amount", {
		month: "2025-12",
		category: categoryIds.Savings,
		amount: 2695500,
	});
	await send("budget/check-templates");

	// Actual's own logo, served by the server under test.
	await send("preferences/save", {
		id: "abt:budget-icon",
		value: JSON.stringify({ type: "url", value: "/apple-touch-icon.png" }),
	});

	const { id: budgetId } = await send("load-prefs");
	const june = (name, date) => added.find((t) => t.payee === payeeIds[name] && t.date === date).id;
	return {
		accountIds,
		budgetId,
		groupSections,
		categoryIds,
		payeeIds,
		cityPower: june("City Power", "2026-06-08"),
		fuelStop: june("Fuel Stop", "2026-06-09"),
	};
}

async function applySettings(page, { accountIds, budgetId, groupSections }, settings) {
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
		[settings, icons, SHORTCUTS, budgetId, groupSections],
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
					${around}, ${around} *, [data-docs-marks], [data-docs-marks] * {
						visibility: visible !important;
					}
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
	const panel = "[data-abt-side-drawer-sidebar]";
	await shot(page, "reconcile-preview", panel, { room: 0, cutout: true });
	await annotate(page, [
		".rp__hero",
		".rp__list",
		".rp__adjust .abt-btn",
		".rp__footer .abt-tone-accent",
	]);
	await shot(page, "reconcile", panel, { room: 0, cutout: true });
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
	const palette = { room: 0, cutout: true };
	await shot(page, "palette", ".cp", palette);

	await input.fill("145.20 * 12");
	await page.waitForTimeout(400);
	await shot(page, "palette-math", ".cp", palette);

	await input.fill("reconcile");
	await page.waitForTimeout(400);
	await shot(page, "palette-tweaks", ".cp", palette);
	await page.keyboard.press("Escape");
}

async function insightsShots(page) {
	await page.setViewportSize({ width: 1400, height: 980 });
	await page.goto(`${BASE}/budget`);
	await page.locator(BUDGET_TABLE).waitFor();
	await page.waitForTimeout(1500);
	await page.keyboard.press("Control+k");
	await page.locator(".cp-input").fill("insights");
	await page.keyboard.press("Enter");
	await page.locator(".abt-tab-overview-toolbar").waitFor();
	await page.waitForTimeout(2500);

	const panel = "[data-abt-side-drawer-sidebar]";
	const options = { room: 0, cutout: true };
	const tab = (name) => page.locator(".abt-tabs__tab", { hasText: name }).click();

	await page.locator(".abt-tab-overview-toolbar button").first().click();
	await page.waitForTimeout(3000);
	await tab("Breakdown");
	await page.waitForTimeout(1500);
	await shot(page, "insights-breakdown", panel, { ...options, height: 640 });

	await tab("Priority plan");
	await page.waitForTimeout(2500);
	await shot(page, "insights-priority", panel, { ...options, height: 640 });

	await tab("Overview");
	await page.waitForTimeout(2500);
	await shot(page, "insights-overview", panel, options);
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

/** June's power bill runs high, and a fuel charge was filed by hand against its rule. */
async function seedInspection(page, { accountIds, categoryIds, payeeIds, cityPower, fuelStop }) {
	const send = (name, args) =>
		page.evaluate(([name, args]) => window.$send(name, args), [name, args]);
	for (const [payee, category] of Object.entries(RULES)) {
		await send("rule-add", {
			stage: null,
			conditionsOp: "and",
			conditions: [{ op: "is", field: "payee", value: payeeIds[payee], type: "id" }],
			actions: [{ op: "set", field: "category", value: categoryIds[category], type: "id" }],
		});
	}
	const schedule = await send("schedule/create", {
		schedule: { name: "Power bill", posts_transaction: false },
		conditions: [
			{ op: "is", field: "payee", value: payeeIds["City Power"] },
			{ op: "is", field: "account", value: accountIds["Everyday Checking"] },
			{ op: "isapprox", field: "amount", value: -8640 },
			{
				op: "isapprox",
				field: "date",
				value: {
					start: "2026-01-08",
					frequency: "monthly",
					patterns: [],
					skipWeekend: false,
					weekendSolveMode: "after",
					endMode: "never",
					endOccurrences: 1,
					endDate: "2026-12-31",
					interval: 1,
				},
			},
		],
	});
	await send("transactions-batch-update", {
		updated: [
			{ id: cityPower, amount: -11740, schedule },
			{ id: fuelStop, category: categoryIds.Fun },
		],
	});
}

async function inspectorShots(page, seeded) {
	await seedInspection(page, seeded);
	const panel = "[data-abt-side-drawer-sidebar]";
	const options = { room: 0, cutout: true };
	const inspect = async (account, id) => {
		await page.goto(`${BASE}/accounts/${seeded.accountIds[account]}`);
		await page.getByRole("button", { name: "Inspect" }).click();
		await page.locator(panel).waitFor();
		await page.locator(`[data-focus-key="${id}"] [data-testid="select"]`).click();
		await page.locator(".summary").waitFor();
		await page.mouse.move(700, 30);
		await page.waitForTimeout(1500);
	};

	await page.setViewportSize({ width: 1400, height: 760 });
	await inspect("Everyday Checking", seeded.cityPower);
	// Actual works out the next date in its worker, which runs on the real clock, not the fixed one.
	await page.locator(".schedule__next").evaluate((el) => (el.textContent = "next Jul 8"));
	await shot(page, "inspector", panel, options);
	await inspect("Rewards Card", seeded.fuelStop);
	await shot(page, "inspector-rules", panel, { ...options, height: 420 });
	await page.getByRole("button", { name: "Inspect" }).click();
}

async function recapShots(page, { accountIds }) {
	const send = (name, args) =>
		page.evaluate(([name, args]) => window.$send(name, args), [name, args]);
	// Tall enough for every account's list above the footer.
	await page.setViewportSize({ width: 1400, height: 1100 });
	await page.goto(`${BASE}/budget`);
	await page.locator(BUDGET_TABLE).waitFor();
	await page.waitForTimeout(1500);

	const result = { added: [], matched: [], failed: [] };
	for (const account of new Set(IMPORT.map(([name]) => name))) {
		const { added, updated } = await send("transactions-import", {
			accountId: accountIds[account],
			isPreview: false,
			transactions: IMPORT.filter(([name]) => name === account).map(
				([, payee, amount, date], i) => ({
					date,
					amount,
					payee_name: payee,
					imported_payee: payee,
					imported_id: `docs-${account}-${i}`,
				}),
			),
		});
		result.added.push(...added);
		result.matched.push(...updated);
	}
	// Actual raises this from its store after a sync; a direct import doesn't reach the store.
	await page.evaluate(
		(detail) => document.dispatchEvent(new CustomEvent("abt:api:imported", { detail })),
		JSON.stringify(result),
	);

	const review = page.getByRole("button", { name: "Review" });
	await review.waitFor();
	await page.waitForTimeout(800);
	const toast = page.getByText("Imported 7 transactions");
	await toast.evaluate((el) => {
		el.closest('[role="alert"], [data-abt-toast]')?.setAttribute("data-docs-toast", "");
	});
	await shot(page, "recap-toast", "[data-docs-toast]", { room: 0, cutout: true });
	await review.click();
	const panel = "[data-abt-side-drawer-sidebar]";
	await page.getByText("Needs a category").waitFor();
	await page.waitForTimeout(1200);
	await page.getByRole("combobox", { name: "Category for Garden Center" }).selectOption({
		label: "🍿 Fun",
	});
	await page.waitForTimeout(800);
	await shot(page, "recap", panel, { room: 0, cutout: true });
}

/** The same budget with ABT and, with its files blocked, without. */
async function heroShots(page) {
	await page.setViewportSize({ width: 1500, height: 853 });
	const open = async () => {
		await page.goto(`${BASE}/budget`);
		await page.locator(BUDGET_TABLE).waitFor();
		await dismissWelcome(page);
		await page.waitForTimeout(2000);
	};
	await open();
	await page.keyboard.press("Control+k");
	await page.locator(".cp-input").fill("insights");
	await page.keyboard.press("Enter");
	await page.locator(".abt-tab-overview-toolbar").waitFor();
	await page.mouse.move(700, 20);
	await dismissWelcome(page);
	await page.waitForTimeout(3000);
	await page.screenshot({ path: resolve(HERO, "hero-abt.png") });

	await page.route("**/abt/**", (route) => route.abort());
	await open();
	await page.mouse.move(700, 20);
	await page.waitForTimeout(800);
	await page.screenshot({ path: resolve(HERO, "hero-actual.png") });
	await page.unroute("**/abt/**");
}

/** Dark, then light, in one session: settings sync would undo the theme change on a reload. */
async function readmeShots(page, seeded) {
	await page.setViewportSize({ width: 1512, height: 865 });
	await page.goto(`${BASE}/budget`);
	await page.locator(BUDGET_TABLE).waitFor();
	await page.waitForTimeout(1500);
	await seedInspection(page, seeded);
	await page.goto(`${BASE}/budget`);
	await page.locator(BUDGET_TABLE).waitFor();
	await page.addStyleTag({ content: '[role="alert"] { display: none !important; }' });
	await page.waitForTimeout(1500);

	const input = page.locator(".cp-input");
	const snap = async (name) => {
		await page.mouse.move(800, 20);
		await page.waitForTimeout(2500);
		await page.screenshot({ path: resolve(README_IMAGES, `${name}.png`) });
		console.log(`wrote ${name}`);
	};

	const calendar = async () => {
		await page.keyboard.press("Control+k");
		await input.fill("spending calendar");
		await page.keyboard.press("Enter");
		await page.locator("[data-abt-calendar]").waitFor();
	};

	await page.keyboard.press("Control+k");
	await input.fill("insights");
	await page.keyboard.press("Enter");
	await page.locator(".abt-tab-overview-toolbar").waitFor();
	await snap("budget-dark");
	await calendar();
	await snap("calendar-dark");

	// Running anything from the palette closes the calendar, so this lands back on the budget.
	await page.keyboard.press("Control+k");
	await input.fill("change theme");
	await page.keyboard.press("Enter");
	await page.waitForTimeout(400);
	await input.fill("daylight");
	await page.waitForTimeout(300);
	await page.keyboard.press("Enter");
	await snap("budget-light");
	await calendar();
	await snap("calendar-light");
}

/** Enough left in savings for every template, so the hero isn't a month of overspending. */
async function fundJune(page, { categoryIds }) {
	const send = (name, args) =>
		page.evaluate(([name, args]) => window.$send(name, args), [name, args]);
	await send("budget/budget-amount", {
		month: "2025-12",
		category: categoryIds.Savings,
		amount: 2569000,
	});
	for (const [name, [, amount]] of Object.entries(TEMPLATES)) {
		await send("budget/budget-amount", { month: "2026-06", category: categoryIds[name], amount });
	}
}

const home = process.argv.includes("--home");
const readme = process.argv.includes("--readme");
const stop = await startStack();
const browser = await chromium.launch();
try {
	const context = await browser.newContext({
		viewport: { width: 1400, height: 860 },
		deviceScaleFactor: 2,
		colorScheme: "light",
		// A service worker's requests would get past the route that blocks ABT's files.
		serviceWorkers: home ? "block" : "allow",
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
	if (home || readme) {
		await fundJune(page, seeded);
	}
	await applySettings(page, seeded, readme ? README_SETTINGS : home ? HOME_SETTINGS : SETTINGS);
	await page.reload();
	await page.waitForFunction(() => typeof window.$send === "function");
	if (home) {
		await heroShots(page);
	} else if (readme) {
		await readmeShots(page, seeded);
	} else {
		await reconcileShot(page, seeded);
		await paletteShots(page);
		await insightsShots(page);
		await sidebarShots(page);
		await inspectorShots(page, seeded);
		await recapShots(page, seeded);
	}
} finally {
	await browser.close();
	stop();
}
