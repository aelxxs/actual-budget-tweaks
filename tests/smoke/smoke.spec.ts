import { type Page, expect, test } from "@playwright/test";

import {
	BUDGET_TABLE,
	MOBILE_PAGE_ANCHORS,
	PAGE_ANCHORS,
	REPORTS_PAGE,
} from "../../src/lib/actual-dom";
import sections from "../../website/src/data/features.json" with { type: "json" };

/**
 * Opens every page Actual has with every ABT tweak on, and fails on ABT errors, on a marker ABT
 * should have set, or on an Actual anchor ABT relies on. Catches the breakage type checks can't:
 * an Actual release that moves an anchor.
 *
 * One test with a step per page, and soft checks, so a run lists everything that broke.
 * Expects a fresh server: it sets the password and creates the budget.
 */

interface ManifestSetting {
	key: string;
	type: string;
	label: string;
	platform: string;
}

const PASSWORD = "abt-smoke-test";
const SETTINGS = (sections as { items: ManifestSetting[] }[]).flatMap((section) => section.items);
const STYLE_SETTINGS =
	(sections as { title: string; items: ManifestSetting[] }[]).find(
		(section) => section.title === "Style",
	)?.items ?? [];
const SIDEBAR_CUSTOMIZE_SETTINGS =
	(sections as { title: string; items: ManifestSetting[] }[]).find(
		(section) => section.title === "Customize sidebar",
	)?.items ?? [];
const ABT_SCRIPT = "/abt/";

const errors: string[] = [];

function watchErrors(page: Page): void {
	page.on("pageerror", (error) => {
		if (error.stack?.includes(ABT_SCRIPT)) {
			errors.push(`uncaught: ${error.message}`);
		}
	});
	page.on("console", (message) => {
		if (message.type() === "error" && message.text().includes("ABT")) {
			errors.push(`console: ${message.text()}`);
		}
	});
}

/** A page's checks, as a step with its screenshot attached. */
async function visit(page: Page, name: string, checks: () => Promise<void>): Promise<void> {
	await test.step(name, async () => {
		errors.length = 0;
		await checks();
		expect.soft(errors.splice(0), `ABT errors on ${name}`).toEqual([]);
		await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
	});
}

async function expectAttached(page: Page, selector: string, what = selector): Promise<void> {
	await expect.soft(page.locator(selector).first(), what).toBeAttached();
}

async function expectAnchors(page: Page, anchors: Record<string, string> = {}): Promise<void> {
	for (const [name, selector] of Object.entries(anchors)) {
		await expectAttached(page, selector, `Actual's ${name}: ${selector}`);
	}
}

/**
 * Sets the server password, signs in, and creates a budget with an on- and an off-budget account
 * and a loan whose note has a saved payoff plan. Returns the loan's account id.
 */
async function createBudget(page: Page): Promise<string> {
	await page.goto("/");
	const confirm = page.getByRole("textbox", { name: "Confirm password" });
	await expect(confirm).toBeVisible();
	await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
	await confirm.fill(PASSWORD);
	await confirm.press("Enter");
	const signIn = page.locator('input[type="password"]');
	await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
	await signIn.fill(PASSWORD);
	await signIn.press("Enter");

	await page.getByRole("button", { name: "Start budgeting" }).click();
	await expect(page.locator(BUDGET_TABLE)).toBeVisible({ timeout: 30_000 });
	await page.waitForFunction(() => typeof (window as { $send?: unknown }).$send === "function");
	return page.evaluate(async () => {
		const send = (
			window as unknown as { $send: (name: string, args?: unknown) => Promise<unknown> }
		).$send;
		await send("account-create", { name: "Checking", balance: 250000, offBudget: false });
		await send("account-create", { name: "House", balance: 30000000, offBudget: true });
		const loan = await send("account-create", { name: "Loan", balance: -5000, offBudget: true });
		await send("notes-save", {
			id: `account-${loan}`,
			note: "Renovation\nloan: rate=0.06 daycount=monthly interestDay=1 payment=500 paymentDay=1 interestPayee=Bank",
		});
		// Interest on the first of the last two months, so there's a rate to measure and this
		// month's charge is due.
		const payee = await send("payee-create", { name: "Bank" });
		const now = new Date();
		const first = (back: number): string =>
			new Date(Date.UTC(now.getFullYear(), now.getMonth() - back, 1)).toISOString().slice(0, 10);
		await send("transactions-batch-update", {
			added: [2, 1].map((back) => ({
				id: crypto.randomUUID(),
				account: loan,
				date: first(back),
				amount: -2500,
				payee,
				cleared: true,
			})),
		});
		// Newer Actual shows only a message, with no table, while the rules list is empty.
		const added = await send("rule-add", {
			stage: null,
			conditionsOp: "and",
			conditions: [{ op: "contains", field: "imported_payee", value: "coffee" }],
			actions: [{ op: "append-notes", value: " (coffee)" }],
		});
		if (added && typeof added === "object" && "error" in added) {
			throw new Error(`rule-add failed: ${JSON.stringify(added)}`);
		}
		return String(loan);
	});
}

interface ActualPage {
	$query: (query: unknown) => Promise<{ data: Record<string, unknown>[] }>;
	$q: (table: string) => {
		filter: (filter: unknown) => { select: (fields: unknown) => unknown };
	};
}

/** An account's note, straight from the budget. */
function accountNote(page: Page, accountId: string): Promise<string | null> {
	return page.evaluate(async (id) => {
		const { $query, $q } = window as unknown as ActualPage;
		const rows = await $query(
			$q("notes")
				.filter({ id: `account-${id}` })
				.select("*"),
		);
		return (rows.data[0]?.note as string | undefined) ?? null;
	}, accountId);
}

function transactionCount(page: Page, accountId: string): Promise<number> {
	return page.evaluate(async (id) => {
		const { $query, $q } = window as unknown as ActualPage;
		return (await $query($q("transactions").filter({ account: id }).select("id"))).data.length;
	}, accountId);
}

/** Actual's first-run toast sits over the side panel's footer. */
async function dismissWelcome(page: Page): Promise<void> {
	const welcome = page.getByText("Welcome to Actual!");
	try {
		await welcome.waitFor({ timeout: 5000 });
		await page.getByRole("button", { name: "Close" }).first().click();
		await welcome.waitFor({ state: "hidden" });
	} catch {
		// Not every Actual version shows it.
	}
}

/** Loan payoff's switch in ABT's settings, set to `on`. */
async function setLoanPayoff(page: Page, on: boolean): Promise<void> {
	await openTweaks(page);
	const features = page.getByRole("button", { name: /^Features(?: All on)?$/ });
	if ((await features.getAttribute("aria-expanded")) === "false") {
		await features.click();
	}
	const row = page.locator('.settings-page [data-testid="loan-payoff"]');
	const toggle = row.locator('input[type="checkbox"]');
	if ((await toggle.isChecked()) !== on) {
		await row.locator(".abt-setting__label").click();
	}
	await (on ? expect(toggle).toBeChecked() : expect(toggle).not.toBeChecked());
}

/** ABT's settings: their own tab where Actual's settings have pages, else a card on the one page. */
async function openTweaks(page: Page): Promise<void> {
	await page.goto("/settings");
	const tab = page.locator("[data-abt-tweaks-link]");
	const panel = page.locator(".settings-page");
	await expect(tab.or(panel).first()).toBeVisible();
	if (await tab.isVisible()) {
		await tab.click();
	}
	await expect(panel).toBeVisible();
}

/** Every checkbox setting on, stored the way the sidecar keeps it, then the rest by clicking. */
async function enableEverything(page: Page): Promise<void> {
	const keys = SETTINGS.filter((setting) => setting.type === "checkbox").map(
		(setting) => setting.key,
	);
	await page.evaluate(async (keys) => {
		const send = (window as unknown as { $send: (name: string, args?: unknown) => Promise<any> })
			.$send;
		const user = await send("subscribe-get-user");
		for (const key of keys) {
			localStorage.setItem(`local:${key}`, "true");
			await send("preferences/save", {
				id: user?.userId ? `abt:${user.userId}:${key}` : `abt:${key}`,
				value: "true",
			});
		}
	}, keys);
	await page.reload();
	await openTweaks(page);
	// Switches inside custom settings aren't in the manifest. Each is marked as tried, so one that
	// stays off (a sub-option of a picker, say) isn't retried.
	for (let guard = 0; guard < 100; guard++) {
		const clicked = await page.evaluate(() => {
			const next = document.querySelector<HTMLInputElement>(
				'.settings-page input[type="checkbox"]:not(:checked):not(:disabled):not([inert] input):not([data-smoke-tried])',
			);
			next?.setAttribute("data-smoke-tried", "");
			next?.click();
			return !!next;
		});
		if (!clicked) {
			return;
		}
		await page.waitForTimeout(50);
	}
	throw new Error("More switches than expected; the settings list may be re-rendering");
}

test("ABT on every page", async ({ page }) => {
	test.setTimeout(300_000);
	await page.setViewportSize({ width: 1400, height: 900 });
	watchErrors(page);
	let loan = "";
	await test.step("set up", async () => {
		loan = await createBudget(page);
		await enableEverything(page);
	});

	await visit(page, "budget", async () => {
		await page.goto("/budget");
		await expect(page.locator(BUDGET_TABLE)).toBeVisible();
		await expectAttached(page, "[data-abt-live-sidebar]");
		await expectAttached(page, "[data-abt-header]");
		await expectAttached(page, "[data-abt-content-grid]");
		await expectAttached(page, "[data-abt-shell]");
		await expectAttached(page, "[data-abt-sidebar-slot]");
		await expectAnchors(page, PAGE_ANCHORS["/budget"]);
	});

	await visit(page, "accounts", async () => {
		await page.goto("/accounts");
		await expectAttached(page, '[data-abt-page="accounts"]');
		await expectAttached(page, "[data-abt-category-id]");
		await expectAttached(page, "[data-abt-account-id]");
		await expect.soft(page.locator("[data-abt-live-sidebar]")).toContainText("House");
		await expectAnchors(page, PAGE_ANCHORS["/accounts"]);
	});

	const panel = page.locator(".lp");
	const summary = page.locator("[data-abt-loan-payoff]").filter({ hasText: "Paid off by" });
	const payoffButton = page.getByRole("button", { name: "Payoff", exact: true });
	// The payoff month the panel leads with, and what a change being tried does to it.
	const headline = panel.locator(".lp__big");
	const delta = panel.locator(".lp__delta");
	const slider = panel.locator(".lp__slider");
	const usePlan = panel.getByRole("button", { name: "Use this plan" });
	const settings = panel.locator(".lp__summary");

	await visit(page, "loan account", async () => {
		await page.goto(`/accounts/${loan}`);
		await dismissWelcome(page);
		await expect.soft(summary, "the payoff summary").toBeVisible();
		await expect.soft(payoffButton, "the Payoff button").toBeVisible();
		await payoffButton.click();
		await expect.soft(panel.getByText("Paid off by"), "the payoff panel").toBeVisible();
		await expect.soft(panel.locator("figure.pc"), "the balance chart").toBeVisible();
		await expect.soft(panel.getByText(/Next payment|This month/), "what's next").toBeVisible();
		await expect.soft(settings, "the saved settings in a line").toContainText("6.00% · monthly");
		await expect.soft(panel.getByText(/Charged .+ recently/), "the rate check").toBeVisible();
	});

	await visit(page, "loan what-ifs", async () => {
		const plan = (await headline.textContent()) ?? "";
		await expect.soft(usePlan, "nothing to use yet").toBeDisabled();

		await slider.fill((await slider.getAttribute("max")) ?? "");
		await expect.soft(headline, "a higher payment finishes sooner").not.toHaveText(plan);
		await expect.soft(delta.first()).toContainText("sooner");
		await expect.soft(panel.getByText("Trying"), "the trial on the chart").toBeVisible();
		await panel.getByRole("button", { name: "Reset" }).click();
		await expect.soft(headline, "back on the plan").toHaveText(plan);
		await expect.soft(delta).toHaveCount(0);

		// An amount between the slider's steps is typed.
		const amount = panel.getByLabel("Payment amount");
		await amount.fill("612.34");
		await amount.press("Enter");
		await expect.soft(delta.first(), "a typed payment").toContainText("sooner");
		await expect.soft(amount).toHaveValue("612.34");
		await amount.fill("1");
		await amount.press("Enter");
		await expect.soft(headline, "a payment under the interest").toHaveText("Never");
		await panel.getByRole("button", { name: "Reset" }).click();
		await expect.soft(headline).toHaveText(plan);

		// A month sooner than the plan takes a higher payment.
		const month = panel.getByLabel("Finish by: month");
		const year = panel.getByLabel("Finish by: year");
		const [m, y] = [Number(await month.inputValue()), Number(await year.inputValue())];
		if (m === 1) {
			await year.selectOption(String(y - 1));
		}
		await month.selectOption(String(m === 1 ? 12 : m - 1).padStart(2, "0"));
		await expect.soft(delta.first(), "finishing by an earlier month").toContainText("1m sooner");
		await expect.soft(usePlan).toBeEnabled();
		await panel.getByRole("button", { name: "Reset" }).click();

		await panel.getByRole("button", { name: "Add a payment" }).click();
		await panel.getByLabel("Extra payment: amount").fill("1000");
		await expect.soft(delta.first(), "what an extra payment saves").toContainText("sooner");
		await expect.soft(usePlan, "a one-off payment isn't a plan to save").toBeDisabled();
		await panel.getByRole("button", { name: "Remove extra payment" }).click();
		await expect.soft(delta).toHaveCount(0);

		const max = Number(await slider.getAttribute("max"));
		await slider.fill(String(max));
		await usePlan.click();
		await expect.soft
			.poll(() => accountNote(page, loan), { message: "the tried payment, saved" })
			.toContain(`payment=${max / 100} `);
		await expect.soft(delta, "the trial is the plan now").toHaveCount(0);
	});

	await visit(page, "loan settings", async () => {
		const rate = panel.getByLabel("Annual rate");
		const save = panel.getByRole("button", { name: "Save", exact: true });
		await settings.click();
		await expect.soft(save, "nothing changed yet").toBeDisabled();
		await rate.fill("7");
		await save.click();
		await expect.soft(settings, "saved and folded away").toContainText("7.00%");
		await expect.soft(rate).toHaveCount(0);
		// The line is rewritten in place; the rest of the note is the user's.
		await expect.soft
			.poll(() => accountNote(page, loan), { message: "the saved note" })
			.toMatch(/^Renovation\nloan: rate=0\.07 .*interestPayee=Bank$/);

		await settings.click();
		await rate.fill("9");
		await panel.getByRole("button", { name: "Cancel" }).click();
		await expect.soft(settings, "cancelled").toContainText("7.00%");

		await settings.click();
		await panel.getByRole("button", { name: "Remove loan details" }).click();
		await expect.soft(summary, "the summary goes with the line").toHaveCount(0);
		await expect.soft
			.poll(() => accountNote(page, loan), { message: "the note without its line" })
			.toBe("Renovation");

		// Back to setting up, with the details still filled in.
		await panel.getByRole("button", { name: "Save and see payoff" }).click();
		await expect.soft(summary, "the summary comes back").toBeVisible();
		await expect.soft(settings).toContainText("7.00%");
	});

	await visit(page, "loan interest", async () => {
		const count = await transactionCount(page, loan);
		const next = panel.locator(".lp__next");
		const add = next.getByRole("button", { name: "Add" });
		await expect.soft(next.getByText("Interest due"), "this month's interest is due").toBeVisible();
		await add.click();
		await expect.soft(page.getByText(/Added .+ of interest/)).toBeVisible();
		await expect.soft.poll(() => transactionCount(page, loan)).toBe(count + 1);
		// With it in the account, the next one is a month away and not for adding yet.
		await expect.soft(next.getByText("Interest due")).toHaveCount(0);
		await expect.soft(add).toHaveCount(0);

		// The toast's, by its text; the sidebar's own undo button is an icon.
		await page.locator("button", { hasText: /^Undo$/ }).click();
		await expect.soft.poll(() => transactionCount(page, loan), { message: "undone" }).toBe(count);
	});

	await visit(page, "loan follows transactions", async () => {
		const [chip, month] = [await summary.textContent(), await headline.textContent()];
		// Straight into the budget, as a bank sync or another device would: only Actual's own
		// table says anything changed.
		await page.evaluate(async (account) => {
			const send = (window as unknown as { $send: (name: string, args: unknown) => Promise<void> })
				.$send;
			await send("transactions-batch-update", {
				added: [
					{
						id: crypto.randomUUID(),
						account,
						date: new Date().toISOString().slice(0, 10),
						amount: 200000,
						cleared: true,
					},
				],
			});
		}, loan);
		await expect.soft(headline, "the panel's plan").not.toHaveText(month ?? "");
		// With a payment in the account, the next one is split into what it's made of.
		await expect.soft(panel.locator(".lp__split")).toContainText("principal");
		const split = (await panel.locator(".lp__split").textContent()) ?? "";
		await slider.fill((await slider.getAttribute("max")) ?? "");
		await expect
			.soft(panel.locator(".lp__split"), "the payment being tried, split the same way")
			.not.toHaveText(split);
		await panel.getByRole("button", { name: "Reset" }).click();
		await expect.soft(summary, "the summary's plan").not.toHaveText(chip ?? "");
	});

	await visit(page, "loan payoff off", async () => {
		const account = page.locator("[data-abt-live-sidebar]").getByText("Loan", { exact: true });
		await setLoanPayoff(page, false);
		await account.first().click();
		await expect(page).toHaveURL(new RegExp(loan));
		await expect.soft(page.locator("[data-abt-loan-payoff]"), "nothing left behind").toHaveCount(0);
		await expect.soft(panel).toHaveCount(0);

		await setLoanPayoff(page, true);
		await account.first().click();
		await expect.soft(payoffButton, "back with the switch").toBeVisible();
		await expect.soft(summary).toBeVisible();
	});

	await visit(page, "reports", async () => {
		await page.goto("/reports");
		await expect(page.locator(REPORTS_PAGE)).toBeVisible();
		await expectAttached(page, "[data-abt-reports-dashboard]");
		await expectAnchors(page, PAGE_ANCHORS["/reports"]);
	});

	// Newer Actual moves payees, rules and tags under /settings/ and redirects the old addresses.
	for (const name of ["schedules", "payees", "rules", "tags"]) {
		await visit(page, name, async () => {
			await page.goto(`/${name}`);
			await expectAttached(page, `[data-abt-page="${name}"]`);
			await expectAnchors(page, PAGE_ANCHORS[`/${name}`]);
		});
	}

	await visit(page, "settings", async () => {
		await openTweaks(page);
		await expectAnchors(page, PAGE_ANCHORS["/settings"]);
		const features = page.getByRole("button", { name: /^Features(?: All on)?$/ });
		await expect(features).toHaveAttribute("aria-expanded", "false");
		await features.click();
		await expect(features).toHaveAttribute("aria-expanded", "true");
		const panelOnlyKeys = new Set([
			...STYLE_SETTINGS.map((setting) => setting.key),
			...SIDEBAR_CUSTOMIZE_SETTINGS.map((setting) => setting.key),
			"customize-sidebar-entry",
			"experimental-sidebar",
		]);
		for (const setting of SETTINGS.filter(
			(setting) => setting.platform !== "mobile" && !panelOnlyKeys.has(setting.key),
		)) {
			const row = page.locator(`.settings-page [data-testid="${setting.key}"]`);
			await expect.soft(row, `${setting.label} (${setting.key}) has a row`).toBeAttached();
			if (setting.type === "checkbox") {
				await expect
					.soft(row.locator('input[type="checkbox"]'), `${setting.key} is on`)
					.toBeChecked();
			}
		}
		await expect(page.getByRole("checkbox", { name: "Live sidebar" })).toBeChecked();

		// Style settings live in the Style side panel; sidebar settings live in its anchored
		// Customize panel. Neither surface is a descendant of the settings page.
		await page.getByRole("button", { name: "Edit style" }).click();
		for (const setting of STYLE_SETTINGS.filter((setting) => setting.platform !== "mobile")) {
			const row = page.locator(`[data-testid="${setting.key}"]`);
			await expect.soft(row, `${setting.label} (${setting.key}) has a row`).toBeAttached();
			if (setting.type === "checkbox") {
				await expect
					.soft(row.locator('input[type="checkbox"]'), `${setting.key} is on`)
					.toBeChecked();
			}
		}
		await page.locator(".abt-side-drawer-close-button").click();

		await page.locator("[data-abt-customize-trigger]").click();
		const customizePanel = page.getByRole("dialog", { name: "Customize sidebar" });
		await expect(customizePanel).toBeVisible();
		const sidebarCheckboxLabels: Record<string, string> = {
			"sidebar-search-enabled": "Search bar",
			"sidebar-shortcuts-enabled": "Shortcuts bar",
			"sidebar-show-closed": "Closed accounts",
			"sidebar-group-totals": "Group totals",
			"account-icon-picker": "Account icons",
		};
		for (const [key, label] of Object.entries(sidebarCheckboxLabels)) {
			await expect
				.soft(customizePanel.getByRole("checkbox", { name: label, exact: true }), `${key} is on`)
				.toBeChecked();
		}
		for (const layout of ["Standard", "Split"]) {
			await customizePanel.getByRole("button", { name: layout, exact: true }).click();
			await customizePanel.getByRole("button", { name: "Done", exact: true }).click();
			const sidebar = page.locator("[data-abt-live-sidebar]");
			for (const [key, label] of [
				["graph-view", "Graph"],
				["spending-calendar-enabled", "Calendar"],
			]) {
				const row = page.locator(`.settings-page [data-testid="${key}"]`);
				const toggle = row.locator('input[type="checkbox"]');
				const link = sidebar.getByRole("button", { name: label, exact: true });
				await expect(link.first()).toBeVisible();
				await row.locator(".abt-setting__label").click();
				await expect(toggle).not.toBeChecked();
				await expect(link).toHaveCount(0);
				await row.locator(".abt-setting__label").click();
				await expect(toggle).toBeChecked();
				await expect(link.first()).toBeVisible();
			}
			await page.locator("[data-abt-customize-trigger]").click();
		}
		await customizePanel.getByRole("button", { name: "Done", exact: true }).click();
	});

	await page.setViewportSize({ width: 420, height: 850 });
	await visit(page, "mobile", async () => {
		await page.goto("/budget");
		await expectAttached(page, "[data-abt-content-grid]");
		await expectAnchors(page, MOBILE_PAGE_ANCHORS["/budget"]);
		await page.goto("/accounts");
		await expectAnchors(page, MOBILE_PAGE_ANCHORS["/accounts"]);
		await openTweaks(page);
	});
});
