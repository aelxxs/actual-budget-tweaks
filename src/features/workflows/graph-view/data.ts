import type { BaseFilters } from "@features/workflows/filters/types";
import { query } from "@lib/actual/actual-api";
import { PRICE_CHANGE, payeeStats } from "@lib/payee-stats";

export type NodeKind = "account" | "payee" | "category";

export interface GraphNode {
	/** `<kind>:<id>`, unique across kinds. */
	id: string;
	kind: NodeKind;
	name: string;
	/** Absolute money through the node, in cents. */
	total: number;
	/** Picked out by the current highlight: a mixed or similar payee, or a shared category. */
	flagged?: boolean;
	/** A group of similar payees drawn as one node: every payee id it stands for. */
	members?: string[];
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	fx?: number | null;
	fy?: number | null;
}

export interface GraphLink {
	source: string | GraphNode;
	target: string | GraphNode;
	total: number;
	/** Money moved from the source account to the target account. */
	transfer?: boolean;
}

export interface Graph {
	nodes: GraphNode[];
	links: GraphLink[];
}

export interface TxRow {
	id: string;
	date: string;
	account: string | null;
	payee: string | null;
	category: string | null;
	amount: number;
	notes: string | null;
	/** The bank's own text, before rules renamed the payee. */
	imported_payee: string | null;
	/** The bank's id for a synced or imported transaction; none when entered by hand. */
	imported_id?: string | null;
	/** Set on each part of a split, to the transaction it was split from. */
	parent_id?: string | null;
}

export interface GraphData {
	rows: TxRow[];
	names: Map<string, string>;
	/** Payees whose transactions land in more than one category, with those categories. */
	mixed: Map<string, Set<string>>;
	/** Categories paid from more than one account, with those accounts. */
	shared: Map<string, Set<string>>;
	/** Payees that look like one place under different names, each group most-used first. */
	similar: string[][];
	/** Same account, payee and amount within a couple of days, each set oldest first. */
	duplicates: TxRow[][];
	/** Steady bills that went up, furthest above their usual first. */
	unusual: Unusual[];
	/** Money through each payee in the range, for ranking which highlighted ones to draw. */
	payeeTotals: Map<string, number>;
	/** The sending side of each transfer, off-budget accounts included, and the account it went to. */
	transfers: (TxRow & { to: string })[];
}

/** How many highlighted payees (or similar-payee groups) the graph draws; the panel lists the rest. */
export const HIGHLIGHT_LIMIT = 25;

export type Highlight = "mixed" | "shared" | "similar" | "duplicates" | "unusual" | null;

export interface Unusual {
	row: TxRow;
	/** The payee's median charge, signed like the row. */
	usual: number;
	/** How far off the usual, as a fraction: 0.8 is 80% more. */
	ratio: number;
}

// Words that don't tell one place from another: "Yumbit Inc" and "Yumbit" are the same place.
const FILLER = new Set(["the", "inc", "llc", "ltd", "co", "corp", "company", "store", "shop"]);

/** A payee name reduced to what identifies the place: no case, punctuation, store numbers or filler. */
function normalize(name: string): string {
	return name
		.toLowerCase()
		.replace(/#\s*\d+/g, " ")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.split(" ")
		.filter((w) => w && !/^\d+$/.test(w) && !FILLER.has(w))
		.join(" ");
}

/** Whether one name is the other with words added after it ("yumbit" and "yumbit seattle"). */
function sameStem(a: string, b: string): boolean {
	const [short, long] = a.length <= b.length ? [a, b] : [b, a];
	if (short.length < 4) {
		return false;
	}
	return (
		short === long ||
		long.startsWith(`${short} `) ||
		short.replaceAll(" ", "") === long.replaceAll(" ", "")
	);
}

/**
 * Groups payees whose names share a stem and whose money goes to at least one of the same
 * categories. Without that overlap a shared stem is usually two businesses (Amazon, Amazon Web
 * Services).
 */
function similarPayees(rows: TxRow[], names: Map<string, string>): string[][] {
	const cats = new Map<string, Set<string>>();
	const uses = new Map<string, number>();
	for (const r of rows) {
		if (r.payee) {
			const set = cats.get(r.payee) ?? new Set<string>();
			set.add(categoryOf(r));
			cats.set(r.payee, set);
			uses.set(r.payee, (uses.get(r.payee) ?? 0) + 1);
		}
	}
	const ids = [...cats.keys()];
	const norm = new Map(ids.map((id) => [id, normalize(names.get(id) ?? "")]));
	const parent = new Map(ids.map((id) => [id, id]));
	const root = (id: string): string => {
		const p = parent.get(id)!;
		return p === id ? id : root(p);
	};
	// Names with a shared stem start with the same four letters once spaces go, so only those
	// are compared; every pair across thousands of payees was slow on long budgets.
	const buckets = new Map<string, string[]>();
	for (const id of ids) {
		const key = norm.get(id)!.replaceAll(" ", "").slice(0, 4);
		if (key.length === 4) {
			buckets.set(key, [...(buckets.get(key) ?? []), id]);
		}
	}
	for (const bucket of buckets.values()) {
		for (let i = 0; i < bucket.length; i++) {
			for (let j = i + 1; j < bucket.length; j++) {
				const a = bucket[i];
				const b = bucket[j];
				if (!sameStem(norm.get(a)!, norm.get(b)!)) {
					continue;
				}
				const overlap = [...cats.get(a)!].some((c) => cats.get(b)!.has(c));
				if (overlap) {
					parent.set(root(a), root(b));
				}
			}
		}
	}
	const groups = new Map<string, string[]>();
	for (const id of ids) {
		const key = root(id);
		groups.set(key, [...(groups.get(key) ?? []), id]);
	}
	return (
		[...groups.values()]
			.filter((g) => g.length > 1)
			// Most used first; on a tie the shorter name, which is usually the plain one.
			.map((g) =>
				g.sort(
					(a, b) =>
						uses.get(b)! - uses.get(a)! ||
						(names.get(a) ?? "").length - (names.get(b) ?? "").length,
				),
			)
	);
}

/** How many days apart two charges can be and still look like one entered twice. */
const DUPLICATE_DAYS = 2;
/** Paid this often in the range, a payee is a habit (a vending machine), and repeats are normal. */
const HABIT_COUNT = 4;

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/**
 * Charges that look entered twice: same account, payee and amount, a couple of days apart at most.
 * Actual already merges imports that share a bank id or match one entered by hand, so a set needs
 * at least one charge without a bank id. Habit payees and parts of one split are left out.
 */
function duplicates(rows: TxRow[]): TxRow[][] {
	const uses = new Map<string, number>();
	for (const r of rows) {
		if (r.payee) {
			uses.set(r.payee, (uses.get(r.payee) ?? 0) + 1);
		}
	}
	const by = new Map<string, TxRow[]>();
	for (const r of rows) {
		if (r.payee && r.amount && uses.get(r.payee)! < HABIT_COUNT) {
			const key = `${r.account}|${r.payee}|${r.amount}`;
			by.set(key, [...(by.get(key) ?? []), r]);
		}
	}
	const sets: TxRow[][] = [];
	for (const list of by.values()) {
		if (list.length < 2) {
			continue;
		}
		list.sort((a, b) => a.date.localeCompare(b.date));
		let run = [list[0]];
		const close = () => {
			if (
				run.length > 1 &&
				run.some((r) => !r.imported_id) &&
				new Set(run.map((r) => r.parent_id ?? r.id)).size > 1
			) {
				sets.push(run);
			}
		};
		for (const r of list.slice(1)) {
			if (dayNumber(r.date) - dayNumber(run.at(-1)!.date) <= DUPLICATE_DAYS) {
				run.push(r);
			} else {
				close();
				run = [r];
			}
		}
		close();
	}
	return sets.sort((a, b) => Math.abs(b[0].amount) - Math.abs(a[0].amount));
}

/** Smaller differences than this, in cents, aren't worth a look. */
const UNUSUAL_FLOOR = 500;

/**
 * Steady bills that went up by a quarter or more, like an internet bill that jumped. A bill keeps
 * both its price and a rhythm (monthly, quarterly, yearly); a restaurant where you order the same
 * thing keeps only the price. An amount the
 * payee has charged before is a second normal price (a fee next to the rent), not a change.
 */
function unusualCharges(rows: TxRow[], history: TxRow[]): Unusual[] {
	const amounts = new Map<string, number[]>();
	const dates = new Map<string, string[]>();
	const seen = new Map<string, number>();
	for (const r of history) {
		if (r.payee && r.amount < 0) {
			const list = amounts.get(r.payee);
			if (list) {
				list.push(-r.amount);
				dates.get(r.payee)!.push(r.date);
			} else {
				amounts.set(r.payee, [-r.amount]);
				dates.set(r.payee, [r.date]);
			}
			const key = `${r.payee}|${r.amount}`;
			seen.set(key, (seen.get(key) ?? 0) + 1);
		}
	}
	const stats = new Map<string, ReturnType<typeof payeeStats>>();
	const statsOf = (payee: string) => {
		let stat = stats.get(payee);
		if (!stat) {
			stat = payeeStats(amounts.get(payee) ?? [], dates.get(payee) ?? []);
			stats.set(payee, stat);
		}
		return stat;
	};
	const found: Unusual[] = [];
	for (const r of rows) {
		const stat = r.payee && r.amount < 0 ? statsOf(r.payee) : null;
		if (
			!stat?.steady ||
			-r.amount - stat.usual < UNUSUAL_FLOOR ||
			(seen.get(`${r.payee}|${r.amount}`) ?? 0) > 1
		) {
			continue;
		}
		const ratio = -r.amount / stat.usual - 1;
		if (ratio >= PRICE_CHANGE) {
			found.push({ row: r, usual: -stat.usual, ratio });
		}
	}
	return found.sort((a, b) => Math.abs(b.row.amount - b.usual) - Math.abs(a.row.amount - a.usual));
}

/** Uncategorized transactions share one category node. */
const NONE = "uncategorized";

function isoDaysAgo(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toISOString().slice(0, 10);
}

const categoryOf = (r: TxRow) => r.category ?? NONE;

function spread(rows: TxRow[], key: (r: TxRow) => string | null, value: (r: TxRow) => string) {
	const by = new Map<string, Set<string>>();
	for (const r of rows) {
		const k = key(r);
		if (k) {
			const set = by.get(k) ?? new Set<string>();
			set.add(value(r));
			by.set(k, set);
		}
	}
	return new Map([...by].filter(([, set]) => set.size > 1));
}

const TX_FIELDS = [
	"id",
	"date",
	"account",
	"payee",
	"category",
	"amount",
	"notes",
	"imported_payee",
	"imported_id",
	"parent_id",
];

export interface FilterLists {
	accounts: { id: string; name: string; offbudget: boolean; closed: boolean }[];
	categories: { id: string; name: string; group: string }[];
	categoryGroups: { id: string; name: string }[];
}

/** A range as loaded, before the filters narrow it. */
export interface RawGraphData {
	rows: TxRow[];
	/** The year before the range, for each payee's usual charge. */
	before: TxRow[];
	transfers: (TxRow & { to: string })[];
	names: Map<string, string>;
	offBudget: Set<string>;
	lists: FilterLists;
}

/**
 * The range's on-budget transactions and transfers, and the names they point at; 0 days is all
 * time. Off-budget accounts can't carry categories, so they'd only pile onto Uncategorized, but
 * their transfers stay to show where money left the budget for.
 */
export async function loadGraphData(days: number): Promise<RawGraphData> {
	const inRange = days > 0 ? [{ date: { $gte: isoDaysAgo(days) } }] : [];
	const [all, sent, accounts, payees, categories, categoryGroups, before] = await Promise.all([
		query<TxRow[]>("transactions", {
			filter: { $and: [...inRange, { transfer_id: null }] },
			select: TX_FIELDS,
			options: { splits: "inline" },
		}),
		// Each transfer is two transactions; the sending side is enough.
		query<TxRow[]>("transactions", {
			filter: { $and: [...inRange, { transfer_id: { $ne: null } }, { amount: { $lt: 0 } }] },
			select: TX_FIELDS,
			options: { splits: "inline" },
		}),
		query<FilterLists["accounts"]>("accounts", {
			select: ["id", "name", "offbudget", "closed"],
		}),
		query<{ id: string; name: string; transfer_acct: string | null }[]>("payees", {
			select: ["id", "name", "transfer_acct"],
		}),
		query<FilterLists["categories"]>("categories", { select: ["id", "name", "group"] }),
		query<FilterLists["categoryGroups"]>("category_groups", { select: ["id", "name"] }),
		// The year before the range, for each payee's usual charge; all time already has it.
		days > 0
			? query<TxRow[]>("transactions", {
					filter: {
						$and: [
							{ date: { $gte: isoDaysAgo(days + 365) } },
							{ date: { $lt: isoDaysAgo(days) } },
							{ transfer_id: null },
						],
					},
					select: ["id", "date", "account", "payee", "category", "amount"],
					options: { splits: "inline" },
				})
			: Promise.resolve([] as TxRow[]),
	]);
	const names = new Map<string, string>([[NONE, "Uncategorized"]]);
	for (const list of [accounts, payees, categories]) {
		for (const { id, name } of list) {
			names.set(id, name);
		}
	}
	const accountIds = new Set(accounts.map((a) => a.id));
	const transferTo = new Map<string, string>();
	for (const p of payees) {
		if (p.transfer_acct && accountIds.has(p.transfer_acct)) {
			transferTo.set(p.id, p.transfer_acct);
			// Transfer payees have no name of their own; Actual shows the account's.
			names.set(p.id, names.get(p.transfer_acct) ?? "Transfer");
		}
	}
	const offBudget = new Set(accounts.filter((a) => a.offbudget).map((a) => a.id));
	const onBudget = (r: TxRow) =>
		!!r.account && accountIds.has(r.account) && !offBudget.has(r.account);
	return {
		rows: all.filter(onBudget),
		before: before.filter(onBudget),
		transfers: sent.flatMap((r) => {
			const to = r.payee ? transferTo.get(r.payee) : undefined;
			return r.account && accountIds.has(r.account) && to && to !== r.account ? [{ ...r, to }] : [];
		}),
		names,
		offBudget,
		lists: { accounts, categories, categoryGroups },
	};
}

export type GraphFilters = BaseFilters;

/**
 * The range narrowed by the filters, with every highlight worked out from what's left. Transfers
 * aren't spending or income, so the flow leaves them be.
 */
export function filterGraphData(raw: RawGraphData, f: GraphFilters): GraphData {
	const hiddenAccounts = new Set(f.hiddenAccounts);
	const hiddenCategories = new Set(f.hiddenCategories);
	const keep = (r: TxRow) =>
		!hiddenAccounts.has(r.account!) &&
		!hiddenCategories.has(categoryOf(r)) &&
		(f.flow === "all" || (f.flow === "spending" ? r.amount < 0 : r.amount > 0));
	const rows = raw.rows.filter(keep);
	const shown = (id: string) =>
		!hiddenAccounts.has(id) && !(f.hideOffBudget && raw.offBudget.has(id));
	const transfers = raw.transfers.filter((t) => shown(t.account!) && shown(t.to));
	const names = raw.names;
	return {
		rows,
		names,
		mixed: spread(rows, (r) => r.payee, categoryOf),
		shared: spread(
			rows,
			(r) => r.category,
			(r) => r.account!,
		),
		similar: similarPayees(rows, names),
		duplicates: duplicates(rows),
		unusual: unusualCharges(rows, [...raw.before.filter(keep), ...rows]),
		payeeTotals: rows.reduce(
			(totals, r) =>
				r.payee ? totals.set(r.payee, (totals.get(r.payee) ?? 0) + Math.abs(r.amount)) : totals,
			new Map<string, number>(),
		),
		transfers,
	};
}

/**
 * Accounts joined to the categories they pay for, always. Each expanded node adds its payees, an
 * expanded payee its accounts and categories, and highlighting mixed payees adds each of those
 * joined to its categories.
 */
export function buildGraph(
	{ rows, names, mixed, shared, similar, duplicates, unusual, payeeTotals, transfers }: GraphData,
	expanded: ReadonlySet<string>,
	highlight: Highlight,
	/** Highlighted payees (or groups, by their first payee) added from the panel past the limit. */
	picked: ReadonlySet<string> = new Set(),
): Graph {
	const total = (ids: string[]) => ids.reduce((sum, id) => sum + (payeeTotals.get(id) ?? 0), 0);
	// The largest few highlighted payees, plus any picked; drawing all of them on a long range
	// buried the graph and slowed it to a crawl.
	const drawnMixed = new Set(
		highlight === "mixed"
			? [...mixed.keys()]
					.sort((a, b) => (payeeTotals.get(b) ?? 0) - (payeeTotals.get(a) ?? 0))
					.slice(0, HIGHLIGHT_LIMIT)
					.concat([...picked].filter((id) => mixed.has(id)))
			: [],
	);
	// A similar group draws as one node under its first payee, unless picked (Show), when its
	// payees are opened out one by one instead.
	const alias = new Map<string, string>();
	const similarIds = new Set<string>();
	if (highlight === "similar") {
		const ranked = [...similar].sort((a, b) => total(b) - total(a));
		ranked.forEach((group, i) => {
			if (picked.has(group[0])) {
				group.forEach((id) => similarIds.add(id));
			} else if (i < HIGHLIGHT_LIMIT) {
				group.forEach((id) => alias.set(id, group[0]));
				similarIds.add(group[0]);
			}
		});
	}
	const groupOf = new Map(similar.map((g) => [g[0], g]));
	// Flagged charges come largest first, so the first few payees are the ones worth drawing.
	const drawnCharges = new Set<string>();
	if (highlight === "duplicates" || highlight === "unusual") {
		const payees =
			highlight === "duplicates"
				? duplicates.map((set) => set[0].payee!)
				: unusual.map((u) => u.row.payee!);
		for (const id of payees) {
			if (drawnCharges.size >= HIGHLIGHT_LIMIT) {
				break;
			}
			drawnCharges.add(id);
		}
		for (const id of picked) {
			drawnCharges.add(id);
		}
	}

	const nodes = new Map<string, GraphNode>();
	const links = new Map<string, GraphLink>();
	const node = (kind: NodeKind, id: string) => {
		const key = `${kind}:${id}`;
		if (!nodes.has(key)) {
			const members = kind === "payee" && alias.get(id) === id ? groupOf.get(id) : undefined;
			const name = names.get(id) ?? "Unknown";
			nodes.set(key, {
				id: key,
				kind,
				name: members ? `${name} +${members.length - 1}` : name,
				total: 0,
				members,
				flagged:
					(kind === "payee" &&
						(drawnMixed.has(id) || similarIds.has(id) || drawnCharges.has(id))) ||
					(highlight === "shared" && kind === "category" && shared.has(id)),
			});
		}
		return key;
	};
	const link = (a: string, b: string, amount: number, transfer = false) => {
		const key = `${a}|${b}`;
		const found = links.get(key);
		if (found) {
			found.total += amount;
		} else {
			links.set(key, { source: a, target: b, total: amount, transfer });
		}
	};

	for (const r of transfers) {
		const amount = Math.abs(r.amount);
		const from = node("account", r.account!);
		const to = node("account", r.to);
		nodes.get(from)!.total += amount;
		nodes.get(to)!.total += amount;
		link(from, to, amount, true);
	}

	for (const r of rows) {
		const amount = Math.abs(r.amount);
		const account = node("account", r.account!);
		const category = node("category", categoryOf(r));
		nodes.get(account)!.total += amount;
		nodes.get(category)!.total += amount;
		link(account, category, amount);

		if (!r.payee) {
			continue;
		}
		const payeeId = alias.get(r.payee) ?? r.payee;
		const payeeKey = `payee:${payeeId}`;
		const fromAccount = expanded.has(account);
		const fromCategory = expanded.has(category);
		const fromPayee = expanded.has(payeeKey);
		const fromCharge = drawnCharges.has(payeeId);
		const fromHighlight = drawnMixed.has(payeeId) || similarIds.has(payeeId) || fromCharge;
		if (!fromAccount && !fromCategory && !fromPayee && !fromHighlight) {
			continue;
		}
		const payee = node("payee", payeeId);
		nodes.get(payee)!.total += amount;
		if (fromAccount || fromPayee || fromCharge) {
			link(account, payee, amount);
		}
		if (fromCategory || fromPayee || fromHighlight) {
			link(payee, category, amount);
		}
	}
	return { nodes: [...nodes.values()], links: [...links.values()] };
}

/** The transactions behind a node, newest first. */
export function rowsFor({ rows }: GraphData, nodeId: string, members?: string[]): TxRow[] {
	const at = nodeId.indexOf(":");
	const kind = nodeId.slice(0, at);
	const id = nodeId.slice(at + 1);
	const payees = new Set(members ?? [id]);
	const match = (r: TxRow) =>
		kind === "account"
			? r.account === id
			: kind === "payee"
				? !!r.payee && payees.has(r.payee)
				: categoryOf(r) === id;
	return rows.filter(match).sort((a, b) => b.date.localeCompare(a.date));
}

export interface TransferSum {
	/** The newest transfer behind the sum, which the inspector opens. */
	id: string;
	/** The account at the other end. */
	account: string;
	/** Signed from this account's side: negative went out, positive came in. */
	amount: number;
	count: number;
}

/** An account's transfers summed per other account and direction, largest first. */
export function transfersFor({ transfers }: GraphData, nodeId: string): TransferSum[] {
	const id = nodeId.slice(nodeId.indexOf(":") + 1);
	const sums = new Map<string, TransferSum & { date: string }>();
	for (const t of transfers) {
		const out = t.account === id;
		if (!out && t.to !== id) {
			continue;
		}
		const other = out ? t.to : t.account!;
		const key = `${out ? "out" : "in"}:${other}`;
		const sum = sums.get(key) ?? { id: t.id, date: t.date, account: other, amount: 0, count: 0 };
		sum.amount += out ? t.amount : -t.amount;
		sum.count++;
		if (t.date > sum.date) {
			sum.id = t.id;
			sum.date = t.date;
		}
		sums.set(key, sum);
	}
	return [...sums.values()]
		.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
		.map(({ date: _, ...sum }) => sum);
}

export interface Searchable {
	id: string;
	kind: NodeKind;
	name: string;
}

/** Every node the range could show, whether or not it's on the graph yet. */
export function searchable({ rows, names, transfers }: GraphData): Searchable[] {
	const found = new Map<string, Searchable>();
	const add = (kind: NodeKind, id: string) => {
		const key = `${kind}:${id}`;
		if (!found.has(key)) {
			found.set(key, { id: key, kind, name: names.get(id) ?? "Unknown" });
		}
	};
	for (const r of rows) {
		add("account", r.account!);
		add("category", categoryOf(r));
		if (r.payee) {
			add("payee", r.payee);
		}
	}
	for (const t of transfers) {
		add("account", t.account!);
		add("account", t.to);
	}
	return [...found.values()];
}
