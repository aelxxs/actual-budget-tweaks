/**
 * The hooks into Actual's DOM that ABT relies on, in one place: when an Actual update moves one,
 * this is the file to fix. Prefer test ids, roles, links and structure over hashed classes and
 * translated text.
 * No imports, so the smoke test (tests/smoke) can check these against a real Actual.
 */
export const byTestId = (id: string) => `[data-testid="${id}"]`;

/** A row in the budget table, a transaction table or a list page's table. */
export const ROW = byTestId("row");
/** Spreadsheet-backed values carry their cell's name, e.g. "budget202610!to-budget". */
export const CELL = "[data-cellname]";
/** List pages' tables (payees, rules, schedules, tags), not the transaction table. */
export const TABLE = byTestId("table");
/** Any modal, e.g. "schedule-edit-modal". */
export const MODAL = '[data-testid$="-modal"]';
/** Lets a cell name a row, e.g. a schedule's in the schedules table. */
export const byFocusKey = (id: string) => `[data-focus-key="${id}"]`;
export const FOCUS_KEY = "[data-focus-key]";

// ── Roles ───────────────────────────────────────────────────────────────

/** The page's own content, inside the content grid. */
export const MAIN = '[role="main"]';
export const DIALOG = '[role="dialog"]';
export const MENU = '[role="menu"]';
export const TOAST = '[role="alert"]';
export const NAVIGATION = '[role="navigation"]';
/** Mobile lists: transactions and accounts are listboxes of options, the budget a grid of rows. */
export const LISTBOX = '[role="listbox"]';
export const OPTION = '[role="option"]';
export const GRID = '[role="grid"]';
export const GRID_ROW = '[role="row"]';

// ── Links ───────────────────────────────────────────────────────────────

/** The sidebar's Budget link, rendered once a budget is open. */
export const BUDGET_LINK = 'a[href="/budget"]';
export const SCHEDULES_LINK = 'a[href="/schedules"]';
export const SETTINGS_LINK = 'a[href="/settings"]';
export const PAYEES_LINK = 'a[href="/payees"]';
/** All accounts and each account. */
export const ACCOUNTS_LINKS = 'a[href^="/accounts"]';
/** Each account, not All accounts. */
export const ACCOUNT_LINK = 'a[href^="/accounts/"]';
/** Newer Actual's settings pages (actualbudget/actual#9110). */
export const SETTINGS_PAGE_LINK = 'a[href^="/settings/"]';
/** Its settings nav; older Actual lists every setting on one page. */
export const SETTINGS_NAV_LINK = `${NAVIGATION} > a[href="/settings/general"]`;

// ── Titlebar and sidebar ────────────────────────────────────────────────

export const HELP_BUTTON = byTestId("help-menu-button");
export const NOTIFICATIONS_BUTTON = byTestId("notifications-button");
export const NOTIFICATIONS_COUNT = byTestId("notifications-unseen-count");
export const SIDEBAR_NAV = byTestId("sidebar-primary-buttons");
export const ALL_ACCOUNTS_BALANCE = byTestId("sidebar-all-accounts-balance");

// ── Budget page ─────────────────────────────────────────────────────────

export const BUDGET_TABLE = byTestId("budget-table");
export const BUDGET_SCROLLER = byTestId("budget-table-scroll-container");
/** The month card above the table: To Budget and its menu. */
export const BUDGET_SUMMARY = byTestId("budget-summary");
/** The table's header row of month totals. */
export const BUDGET_TOTALS = byTestId("budget-totals");
/** Only category rows have it, not group headers. */
export const CATEGORY_NAME = byTestId("category-name");
export const CATEGORY_ROW = `${ROW}:has(${CATEGORY_NAME})`;
/** A category's budgeted amount cell (holds the input while editing). */
export const BUDGETED_CELL = byTestId("budget");
/** A balance cell: a category's in the budget table, or a transaction table's running one. */
export const BALANCE_CELL = byTestId("balance");
/** Each shown month's column in the hidden native month picker. */
export const SELECTED_MONTH = byTestId("selected-budget-month");
export const SHOWN_MONTH = `${SELECTED_MONTH}[data-month]`;
/** A category's spent amount, and its button in the budget table. */
export const SPENT_CELL = byTestId("spent");
export const CATEGORY_SPENT = byTestId("category-month-spent");
/** A category row's amount cells, named "<sheet>!sum-amount-<id>" and "<sheet>!leftover-<id>". */
export const CATEGORY_AMOUNT_CELL = '[data-testid*="sum-amount-"], [data-testid*="leftover-"]';
/** The totals row's labels. */
export const BUDGET_TOTAL_LABELS =
	'[data-testid*="!total-budgeted"], [data-testid*="!total-spent"], [data-testid*="!total-leftover"]';
/** Spreadsheet balances: the sidebar's and accounts' (not balance queries) and categories'. */
export const SHEET_BALANCES =
	"span[data-testid^='__global!balance-']:not([data-testid^='__global!balance-query']), span[data-testid$='-balance']";
/** Envelope budgets' per-category amounts, e.g. "budget202610!sum-amount-<id>". */
export const ENVELOPE_AMOUNT = '[data-testid^="budget2"][data-testid*="!sum-amount-"]';
/** Spreadsheet cells by name: a category's leftover, envelope budgets' Available funds. */
export const LEFTOVER_CELL = '[data-cellname*="!leftover-"]';
export const AVAILABLE_FUNDS_CELL = '[data-cellname*="!available-funds"]';
/** To Budget's cell, whose name Actual builds from an object, so it reads "[object Object]". */
export const TO_BUDGET_CELL = '[data-cellname*="object Object"]';
/** An account's balance cell, "__global!balance-<id>". */
export const ACCOUNT_BALANCE_PREFIX = "__global!balance-";
export const ACCOUNT_BALANCE_CELL = `[data-cellname^="${ACCOUNT_BALANCE_PREFIX}"]`;

// ── Accounts and transaction tables ─────────────────────────────────────

export const ACCOUNT_NAME = byTestId("account-name");
export const ACCOUNT_BALANCE = byTestId("account-balance");
export const TRANSACTION_TABLE = byTestId("transaction-table");
export const TRANSACTION_ROW = `${TRANSACTION_TABLE} ${ROW}`;
export const TRANSACTION_HEADER = byTestId("transaction-table-header");
export const DATE_CELL = byTestId("date");
export const ACCOUNT_CELL = byTestId("account");
export const PAYEE_CELL = byTestId("payee");
export const NOTES_CELL = byTestId("notes");
/** A transaction's category cell ("Categorize" when it has none). */
export const CATEGORY_CELL = byTestId("category");
export const CLEARED_CELL = byTestId("cleared");
export const DEBIT_CELL = byTestId("debit");
export const CREDIT_CELL = byTestId("credit");
export const SELECT_CELL = byTestId("select");
/** A split transaction's parent row's category cell. */
export const GROUP_CELL = byTestId("group");
export const PAYMENT_CELL = byTestId("payment");
export const DEPOSIT_CELL = byTestId("deposit");
/** The transaction table's virtualized list. */
export const AUTO_SIZER = "[data-auto-sizer]";

// ── Layout ──────────────────────────────────────────────────────────────

/** The app's main grid: nav sidebar, titlebar, page column; only once a page has rendered. */
export const CONTENT_GRID = `div:has(> div:nth-child(4)):has(${BUDGET_TABLE}, ${MAIN}, ${ACCOUNT_NAME})`;
/** The page's column, under the grid native-hooks marks. */
export const PAGE_COLUMN = "[data-abt-content-grid] > div:nth-child(4)";
/** Actual's privacy filter: the real value, then a redacted copy over it, shown until hover. */
export const PRIVACY_WRAPPER = 'div:has(> div:first-child + div[aria-hidden="true"]:last-child)';
export const PRIVACY_COPY = `${PRIVACY_WRAPPER} > div[aria-hidden="true"]`;

// ── Other pages ─────────────────────────────────────────────────────────

/** Dashboards and single reports alike. */
export const REPORTS_PAGE = byTestId("reports-page");
/** Each settings card list, one per settings page in newer Actual. */
export const SETTINGS = byTestId("settings");
export const SCHEDULE_EDITOR = byTestId("schedule-edit-modal");
export const AMOUNT_INPUT = byTestId("amount-input");
export const BANK_SYNC_PROVIDER = '[data-testid^="bank-sync-provider-"]';

// ── Mobile ──────────────────────────────────────────────────────────────

export const MOBILE_BUDGET_HEADER = byTestId("budget-table-header");
export const MOBILE_BUDGET_GROUPS = byTestId("budget-groups");
export const MOBILE_GROUP_ROW = byTestId("category-group-row");
export const MOBILE_CATEGORY_ROW = byTestId("category-row");
export const MOBILE_ACCOUNT_ROW = byTestId("account-list-item");
/** A budget card's heading text. */
export const MOBILE_HEADING_NAME = byTestId("name");
export const MOBILE_NAV = `${NAVIGATION}[data-navbar-state]`;

/**
 * What each page should have on a budget with a few accounts and Actual's default categories,
 * keyed by path. Anchors that need an open modal or an edit in progress aren't listed.
 */
export const PAGE_ANCHORS: Record<string, Record<string, string>> = {
	"/budget": {
		CONTENT_GRID,
		PAGE_COLUMN,
		BUDGET_LINK,
		SCHEDULES_LINK,
		ACCOUNT_LINK,
		ACCOUNT_BALANCE_CELL,
		HELP_BUTTON,
		SIDEBAR_NAV,
		ALL_ACCOUNTS_BALANCE,
		BUDGET_TABLE,
		BUDGET_SCROLLER,
		BUDGET_SUMMARY,
		BUDGET_TOTALS,
		CATEGORY_ROW,
		BUDGETED_CELL,
		BALANCE_CELL,
		CATEGORY_SPENT,
		SHOWN_MONTH,
		CELL,
		LEFTOVER_CELL,
		TO_BUDGET_CELL,
	},
	"/accounts": {
		ACCOUNT_NAME,
		ACCOUNT_BALANCE,
		TRANSACTION_TABLE,
		TRANSACTION_ROW,
		FOCUS_KEY,
		AUTO_SIZER,
		DATE_CELL,
		ACCOUNT_CELL,
		PAYEE_CELL,
		NOTES_CELL,
		CATEGORY_CELL,
		CLEARED_CELL,
		SELECT_CELL,
	},
	"/reports": { REPORTS_PAGE, MAIN },
	"/schedules": { TABLE },
	"/payees": { TABLE },
	"/rules": { TABLE },
	"/settings": { SETTINGS, MAIN },
};

/** The same, below Actual's mobile breakpoint. */
export const MOBILE_PAGE_ANCHORS: Record<string, Record<string, string>> = {
	"/budget": {
		MOBILE_NAV,
		MAIN,
		MOBILE_BUDGET_HEADER,
		MOBILE_BUDGET_GROUPS,
		MOBILE_GROUP_ROW,
		MOBILE_CATEGORY_ROW,
		GRID,
		GRID_ROW,
	},
	"/accounts": { MOBILE_ACCOUNT_ROW, ACCOUNT_NAME, LISTBOX, OPTION },
};
