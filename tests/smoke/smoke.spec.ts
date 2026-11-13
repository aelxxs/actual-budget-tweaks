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

/** Sets the server password, signs in, and creates a budget with an on- and an off-budget account. */
async function createBudget(page: Page): Promise<void> {
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
	await page.evaluate(async () => {
		const send = (
			window as unknown as { $send: (name: string, args?: unknown) => Promise<unknown> }
		).$send;
		await send("account-create", { name: "Checking", balance: 250000, offBudget: false });
		await send("account-create", { name: "House", balance: 30000000, offBudget: true });
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
	});
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
	await test.step("set up", async () => {
		await createBudget(page);
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
		await page.getByRole("button", { name: "Close side drawer" }).click();

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
