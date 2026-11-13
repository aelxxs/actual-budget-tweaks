import { query } from "@lib/utilities/actual-api";

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
	/** Money through each payee in the range, for ranking which highlighted ones to draw. */
	payeeTotals: Map<string, number>;
}

/** How many highlighted payees (or similar-payee groups) the graph draws; the panel lists the rest. */
export const HIGHLIGHT_LIMIT = 25;

export type Highlight = "mixed" | "shared" | "similar" | null;

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

/**
 * The range's on-budget transactions (transfers left out) and the names they point at; 0 days is
 * all time. Off-budget accounts can't carry categories, so they'd only pile onto Uncategorized.
 */
export async function loadGraphData(days: number): Promise<GraphData> {
	const inRange = days > 0 ? [{ date: { $gte: isoDaysAgo(days) } }] : [];
	const [all, accounts, payees, categories] = await Promise.all([
		query<TxRow[]>("transactions", {
			filter: { $and: [...inRange, { transfer_id: null }] },
			select: ["id", "date", "account", "payee", "category", "amount", "notes", "imported_payee"],
			options: { splits: "inline" },
		}),
		query<{ id: string; name: string; offbudget: boolean }[]>("accounts", {
			select: ["id", "name", "offbudget"],
		}),
		query<{ id: string; name: string }[]>("payees", { select: ["id", "name"] }),
		query<{ id: string; name: string }[]>("categories", { select: ["id", "name"] }),
	]);
	const names = new Map<string, string>([[NONE, "Uncategorized"]]);
	for (const list of [accounts, payees, categories]) {
		for (const { id, name } of list) {
			names.set(id, name);
		}
	}
	const onBudget = new Set(accounts.filter((a) => !a.offbudget).map((a) => a.id));
	const rows = all.filter((r) => r.account && onBudget.has(r.account));
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
		payeeTotals: rows.reduce(
			(totals, r) =>
				r.payee ? totals.set(r.payee, (totals.get(r.payee) ?? 0) + Math.abs(r.amount)) : totals,
			new Map<string, number>(),
		),
	};
}

/**
 * Accounts joined to the categories they pay for, always. Each expanded node adds its payees, an
 * expanded payee its accounts and categories, and highlighting mixed payees adds each of those
 * joined to its categories.
 */
export function buildGraph(
	{ rows, names, mixed, shared, similar, payeeTotals }: GraphData,
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
					(kind === "payee" && (drawnMixed.has(id) || similarIds.has(id))) ||
					(highlight === "shared" && kind === "category" && shared.has(id)),
			});
		}
		return key;
	};
	const link = (a: string, b: string, amount: number) => {
		const key = `${a}|${b}`;
		const found = links.get(key);
		if (found) {
			found.total += amount;
		} else {
			links.set(key, { source: a, target: b, total: amount });
		}
	};

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
		const fromHighlight = drawnMixed.has(payeeId) || similarIds.has(payeeId);
		if (!fromAccount && !fromCategory && !fromPayee && !fromHighlight) {
			continue;
		}
		const payee = node("payee", payeeId);
		nodes.get(payee)!.total += amount;
		if (fromAccount || fromPayee) {
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

export interface Searchable {
	id: string;
	kind: NodeKind;
	name: string;
}

/** Every node the range could show, whether or not it's on the graph yet. */
export function searchable({ rows, names }: GraphData): Searchable[] {
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
	return [...found.values()];
}
