import { query, send } from "@lib/utilities/actual-api";
import { fmtMoney } from "@lib/utilities/currency";
import { formatDayMonth } from "@lib/utilities/date-format.svelte";

export interface InspectedTransaction {
	id: string;
	date: string;
	amount: number;
	payeeId: string | null;
	payee: string;
	importedPayee: string | null;
	account: string;
	accountName: string;
	categoryId: string | null;
	category: string | null;
	notes: string | null;
	isParent: boolean;
	isChild: boolean;
	transfer: boolean;
}

export interface PayeeHistory {
	count: number;
	average: number;
	/** Typical days between charges, when there are enough to tell. */
	interval: number | null;
	recent: {
		id: string;
		date: string;
		amount: number;
		accountName: string;
		category: string | null;
	}[];
}

export interface RuleSummary {
	id: string;
	/** As Actual stores it, for opening its rule editor. */
	raw: unknown;
	/** "pre" and "post" rules run before and after the default stage. */
	stage: string | null;
	/** Conditions as phrases, leaving out "payee is <this payee>", which every rule here shares. */
	when: Phrase[];
	actions: Phrase[];
	matchAll: boolean;
	/** The schedule that owns this rule; Actual makes one per schedule. */
	schedule: { id: string; name: string } | null;
}

/** Rule wording, with any amount apart so privacy mode can hide it. */
export interface Phrase {
	text: string;
	amount?: string;
}

export interface RuleChange {
	field: string;
	from: string;
	to: string;
}

export interface Schedule {
	id: string;
	name: string | null;
	nextDate: string | null;
}

export interface Inspection {
	tx: InspectedTransaction;
	history: PayeeHistory | null;
	rules: RuleSummary[];
	/** What Actual's rules would set if run on this transaction now, where that differs. */
	changes: RuleChange[];
	schedule: Schedule | null;
}

interface TxRow {
	id: string;
	date: string;
	amount: number;
	payee: string | null;
	payeeName: string | null;
	imported_payee: string | null;
	account: string;
	accountName: string;
	category: string | null;
	categoryName: string | null;
	notes: string | null;
	cleared: boolean;
	schedule: string | null;
	is_parent: boolean;
	is_child: boolean;
	transfer_id: string | null;
}

interface RawCondition {
	field: string;
	op: string;
	value: unknown;
}

interface RawRule {
	id: string;
	stage: string | null;
	conditionsOp: "and" | "or";
	conditions: RawCondition[];
	actions: (RawCondition & { options?: { splitIndex?: number } })[];
}

type Names = Record<"payee" | "category" | "account" | "schedule", Map<string, string>>;

const FIELD_LABELS: Record<string, string> = {
	payee: "Payee",
	imported_payee: "Imported payee",
	category: "Category",
	account: "Account",
	amount: "Amount",
	amount_inflow: "Inflow",
	amount_outflow: "Outflow",
	notes: "Notes",
	date: "Date",
	cleared: "Cleared",
	description: "Payee",
	acct: "Account",
};

const OP_LABELS: Record<string, string> = {
	is: "is",
	isNot: "is not",
	oneOf: "is one of",
	notOneOf: "is not one of",
	contains: "contains",
	doesNotContain: "doesn't contain",
	matches: "matches",
	isapprox: "is about",
	isbetween: "is between",
	gt: "is more than",
	gte: "is at least",
	lt: "is less than",
	lte: "is at most",
	hasTags: "has tags",
	onBudget: "is on budget",
	offBudget: "is off budget",
};

const TX_SELECT: (string | Record<string, string>)[] = [
	"id",
	"date",
	"amount",
	"payee",
	{ payeeName: "payee.name" },
	"imported_payee",
	"account",
	{ accountName: "account.name" },
	"category",
	{ categoryName: "category.name" },
	"notes",
	"cleared",
	"schedule",
	"is_parent",
	"is_child",
	"transfer_id",
];

const RECENT = 6;

export async function inspect(id: string): Promise<Inspection | null> {
	const [row] = await query<TxRow[]>("transactions", {
		filter: { id },
		select: TX_SELECT,
		options: { splits: "all" },
	});
	if (!row) return null;

	const tx: InspectedTransaction = {
		id: row.id,
		date: row.date,
		amount: row.amount,
		payeeId: row.payee,
		payee: row.payeeName || row.imported_payee || "No payee",
		importedPayee: row.imported_payee,
		account: row.account,
		accountName: row.accountName,
		categoryId: row.category,
		category: row.categoryName,
		notes: row.notes,
		isParent: row.is_parent,
		isChild: row.is_child,
		transfer: !!row.transfer_id,
	};

	const [history, names, payeeRules, ran, schedule] = await Promise.all([
		row.payee ? loadHistory(row.payee) : null,
		loadNames(),
		row.payee ? send<RawRule[]>("payees-get-rules", { id: row.payee }).catch(() => []) : [],
		send<Record<string, unknown>>("rules-run", { transaction: stripJoins(row) }).catch(() => null),
		row.schedule ? loadSchedule(row.schedule) : null,
	]);

	return {
		tx,
		history,
		rules: payeeRules.map((r) => describeRule(r, names, row.payee)),
		changes: ran ? diff(row, ran, names) : [],
		schedule,
	};
}

/** The transaction as Actual stores it, without the joined names this query added. */
function stripJoins(row: TxRow): Record<string, unknown> {
	const { payeeName: _p, accountName: _a, categoryName: _c, ...rest } = row;
	return rest;
}

async function loadHistory(payee: string): Promise<PayeeHistory> {
	const rows = await query<TxRow[]>("transactions", {
		filter: { payee },
		select: TX_SELECT,
		options: { splits: "none" },
	});
	rows.sort((a, b) => b.date.localeCompare(a.date));
	const total = rows.reduce((sum, r) => sum + r.amount, 0);
	return {
		count: rows.length,
		average: rows.length ? Math.round(total / rows.length) : 0,
		interval: typicalInterval(rows.map((r) => r.date)),
		recent: rows.slice(0, RECENT).map((r) => ({
			id: r.id,
			date: r.date,
			amount: r.amount,
			accountName: r.accountName,
			category: r.categoryName,
		})),
	};
}

/** The median gap in days between distinct dates, newest first; null with fewer than three. */
function typicalInterval(dates: string[]): number | null {
	const days = [...new Set(dates)].map((d) => Date.parse(`${d}T00:00:00Z`) / 86_400_000);
	if (days.length < 3) return null;
	const gaps = days
		.slice(1)
		.map((d, i) => days[i] - d)
		.sort((a, b) => a - b);
	return Math.round(gaps[Math.floor(gaps.length / 2)]);
}

async function loadNames(): Promise<Names> {
	const named = (table: string) =>
		query<{ id: string; name: string | null }[]>(table, { select: ["id", "name"] });
	const [payees, categories, accounts, schedules] = await Promise.all(
		["payees", "categories", "accounts", "schedules"].map(named),
	);
	const toMap = (rows: { id: string; name: string | null }[]) =>
		new Map(rows.map((r) => [r.id, r.name ?? ""]));
	return {
		payee: toMap(payees),
		category: toMap(categories),
		account: toMap(accounts),
		schedule: toMap(schedules),
	};
}

async function loadSchedule(id: string): Promise<Schedule | null> {
	const [row] = await query<{ id: string; name: string | null; next_date: string | null }[]>(
		"schedules",
		{ filter: { id }, select: ["id", "name", "next_date"] },
	);
	return row ? { id: row.id, name: row.name, nextDate: row.next_date } : null;
}

function label(field: string): string {
	return FIELD_LABELS[field] ?? field;
}

function formatValue(field: string, value: unknown, names: Names): string {
	if (Array.isArray(value)) return value.map((v) => formatValue(field, v, names)).join(", ");
	if (value == null || value === "") return "nothing";
	if (field === "payee" || field === "category" || field === "account") {
		return names[field].get(String(value)) ?? "a deleted " + field;
	}
	if (field === "date" && typeof value === "object") return formatRecurrence(value as Recurrence);
	if (field === "date" && typeof value === "string") return formatDayMonth(value);
	if (field.startsWith("amount") && typeof value === "number") return fmtMoney(value);
	if (field.startsWith("amount") && typeof value === "object") {
		const { num1, num2 } = value as { num1?: number; num2?: number };
		if (num1 != null && num2 != null) return `${fmtMoney(num1)} and ${fmtMoney(num2)}`;
	}
	if (typeof value === "boolean") return value ? "yes" : "no";
	return String(value);
}

/** A schedule's repeat, as Actual stores it on the schedule's date condition. */
interface Recurrence {
	frequency?: "daily" | "weekly" | "monthly" | "yearly";
	interval?: number;
	start?: string;
	patterns?: { type: string; value: number }[];
}

const UNITS = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;

function ordinal(n: number): string {
	if (n === -1) return "last day";
	const tens = n % 100;
	const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
	return `${n}${suffix}`;
}

function formatRecurrence(r: Recurrence): string {
	const unit = UNITS[r.frequency ?? "monthly"];
	const every = (r.interval ?? 1) > 1 ? `every ${r.interval} ${unit}s` : `every ${unit}`;
	const days = r.patterns?.filter((p) => p.type === "day").map((p) => ordinal(p.value));
	if (r.frequency === "monthly" && days?.length) return `${every} on the ${days.join(" and ")}`;
	if (!r.start) return every;
	const [y, m, d] = r.start.split("-").map(Number);
	const start = new Date(y, m - 1, d);
	if (r.frequency === "monthly") return `${every} on the ${ordinal(d)}`;
	if (r.frequency === "weekly")
		return `${every} on ${start.toLocaleDateString(undefined, { weekday: "long" })}`;
	if (r.frequency === "yearly") return `${every} on ${formatDayMonth(r.start)}`;
	return every;
}

function phrase(text: string, field: string, value: unknown, names: Names): Phrase {
	const formatted = formatValue(field, value, names);
	return field.startsWith("amount")
		? { text, amount: formatted }
		: { text: `${text} ${formatted}` };
}

function describeCondition(c: RawCondition, names: Names): Phrase {
	if (c.field === "date" && c.op === "isapprox" && typeof c.value === "object") {
		return { text: `repeats ${formatValue("date", c.value, names)}` };
	}
	const field = label(c.field).toLowerCase();
	const op = OP_LABELS[c.op] ?? c.op;
	if (c.op === "onBudget" || c.op === "offBudget") return { text: `${field} ${op}` };
	return phrase(`${field} ${op}`, c.field, c.value, names);
}

function describeAction(a: RawRule["actions"][number], names: Names): Phrase | null {
	if (a.op === "set")
		return phrase(`set ${label(a.field).toLowerCase()} to`, a.field, a.value, names);
	// Shown as the rule's schedule instead.
	if (a.op === "link-schedule") return null;
	if (a.op === "prepend-notes") return { text: `add “${String(a.value)}” before the notes` };
	if (a.op === "append-notes") return { text: `add “${String(a.value)}” after the notes` };
	if (a.op === "set-split-amount") return { text: "split the transaction" };
	if (a.op === "delete-transaction") return { text: "delete the transaction" };
	return { text: a.op };
}

function describeRule(rule: RawRule, names: Names, payee: string | null): RuleSummary {
	const link = rule.actions.find((a) => a.op === "link-schedule");
	const scheduleId = link ? String(link.value) : null;
	return {
		id: rule.id,
		raw: rule,
		stage: rule.stage,
		matchAll: rule.conditionsOp !== "or",
		when: rule.conditions
			.filter((c) => !(c.field === "payee" && c.op === "is" && c.value === payee))
			.map((c) => describeCondition(c, names)),
		actions: rule.actions
			.map((a) => describeAction(a, names))
			.filter((a): a is Phrase => a != null),
		schedule: scheduleId
			? { id: scheduleId, name: names.schedule.get(scheduleId) || "Unnamed schedule" }
			: null,
	};
}

const DIFF_FIELDS = ["payee", "category", "notes", "account", "cleared"] as const;

function diff(row: TxRow, ran: Record<string, unknown>, names: Names): RuleChange[] {
	const current = row as unknown as Record<string, unknown>;
	return DIFF_FIELDS.filter((f) => f in ran && (ran[f] ?? null) !== (current[f] ?? null)).map(
		(f) => ({
			field: label(f),
			from: formatValue(f, current[f], names),
			to: formatValue(f, ran[f], names),
		}),
	);
}
