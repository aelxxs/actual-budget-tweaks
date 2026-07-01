import { getCurrentPath } from "./route-watcher";

/** Known top-level routes in the Actual Budget app, matched as a `pathname` substring. */
export enum Page {
	Budget = "budget",
	Accounts = "accounts",
	Reports = "reports",
	Schedules = "schedules",
	Payees = "payees",
	Rules = "rules",
	BankSync = "bank-sync",
	Tags = "tags",
	Settings = "settings",
	Calendar = "calendar",
}

export function matchesPage(page: Page): boolean {
	return getCurrentPath().includes(page);
}
