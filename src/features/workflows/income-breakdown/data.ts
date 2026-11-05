import type { Category, CategoryGroup } from "@lib/types/actual-schema";
import { query } from "@lib/utilities/actual-api";
import { isoDate } from "@lib/utilities/months";

export interface BreakdownOptions {
	/** A preset's label, or "" for the custom range in `start` and `end`. */
	preset: string;
	start: string;
	end: string;
	showIncome: boolean;
	showExpense: boolean;
	showSubCategories: boolean;
	showLossGain: boolean;
	groupPositive: boolean;
}

export const DEFAULT_OPTIONS: BreakdownOptions = {
	preset: "This Month",
	start: "",
	end: "",
	showIncome: true,
	showExpense: true,
	showSubCategories: true,
	showLossGain: true,
	groupPositive: false,
};

const monthStart = (year: number, month: number) => isoDate(new Date(year, month, 1));
const monthEnd = (year: number, month: number) => isoDate(new Date(year, month + 1, 0));

/** The last `n` months, this one included. */
function lastMonths(n: number) {
	const now = new Date();
	return {
		start: monthStart(now.getFullYear(), now.getMonth() - (n - 1)),
		end: monthEnd(now.getFullYear(), now.getMonth()),
	};
}

export const PRESETS: { label: string; range: () => { start: string; end: string } }[] = [
	{ label: "This Month", range: () => lastMonths(1) },
	{
		label: "Last Month",
		range: () => {
			const now = new Date();
			return {
				start: monthStart(now.getFullYear(), now.getMonth() - 1),
				end: monthEnd(now.getFullYear(), now.getMonth() - 1),
			};
		},
	},
	{ label: "3 Months", range: () => lastMonths(3) },
	{ label: "6 Months", range: () => lastMonths(6) },
	{ label: "1 Year", range: () => lastMonths(12) },
	{
		label: "Year to Date",
		range: () => {
			const now = new Date();
			return {
				start: `${now.getFullYear()}-01-01`,
				end: monthEnd(now.getFullYear(), now.getMonth()),
			};
		},
	},
	{
		label: "Last Year",
		range: () => {
			const y = new Date().getFullYear() - 1;
			return { start: `${y}-01-01`, end: `${y}-12-31` };
		},
	},
	{
		label: "Prior YTD",
		range: () => {
			const now = new Date();
			const y = now.getFullYear() - 1;
			return { start: `${y}-01-01`, end: isoDate(new Date(y, now.getMonth(), now.getDate())) };
		},
	},
	{ label: "All Time", range: () => ({ start: "2000-01-01", end: isoDate() }) },
];

/** The dates shown: a preset's, worked out today so "This Month" moves with the calendar. */
export function rangeOf(options: BreakdownOptions): { start: string; end: string } {
	const preset = PRESETS.find((p) => p.label === options.preset);
	return preset ? preset.range() : { start: options.start, end: options.end };
}

export interface BreakdownTransaction {
	id: string;
	date: string;
	amount: number;
	notes: string | null;
	cleared: boolean;
	reconciled: boolean;
	category: string | null;
	payee: string | null;
	payeeName: string | null;
	accountName: string | null;
}

export interface Breakdown {
	transactions: BreakdownTransaction[];
	categories: Map<string, Category>;
	groups: Map<string, CategoryGroup>;
}

export async function loadBreakdown(start: string, end: string): Promise<Breakdown> {
	const [transactions, categories, groups] = await Promise.all([
		// Actual's default splits: a split's lines, each with its own category, not the parent.
		query<BreakdownTransaction[]>("transactions", {
			// One operator per field: AQL drops the rest of `{ $gte, $lte }`, here the end date.
			filter: { $and: [{ date: { $gte: start } }, { date: { $lte: end } }] },
			select: [
				"id",
				"date",
				"amount",
				"notes",
				"cleared",
				"reconciled",
				"category",
				"payee",
				{ payeeName: "payee.name" },
				{ accountName: "account.name" },
			],
		}),
		query("categories"),
		query("category_groups"),
	]);
	return {
		transactions,
		categories: new Map(categories.map((c) => [c.id, c])),
		groups: new Map(groups.map((g) => [g.id, g])),
	};
}

export interface SankeyNode {
	id: string;
	name: string;
}

export interface SankeyLink {
	source: string;
	target: string;
	value: number;
}

/** Nodes for the totals in the middle and at the ends, which have no transactions of their own. */
export const SUMMARY_NODES = new Set(["budget", "net-gain", "net-loss", "positive-cats"]);

/** Income flows from payees into the budget, then out to category groups and their categories. */
export function buildSankey(
	{ transactions, categories, groups }: Breakdown,
	options: BreakdownOptions,
): { nodes: SankeyNode[]; links: SankeyLink[]; total: number } {
	const incomes = new Map<string, { name: string; amount: number }>();
	const expenses = new Map<string, Map<string, number>>();
	for (const tx of transactions) {
		const category = tx.category ? categories.get(tx.category) : undefined;
		if (!category) {
			continue;
		}
		if (category.is_income) {
			if (tx.payee) {
				const entry = incomes.get(tx.payee) ?? { name: tx.payeeName ?? "Unknown", amount: 0 };
				entry.amount += tx.amount;
				incomes.set(tx.payee, entry);
			}
		} else if (category.group) {
			const byCategory = expenses.get(category.group) ?? new Map<string, number>();
			byCategory.set(category.id, (byCategory.get(category.id) ?? 0) + tx.amount);
			expenses.set(category.group, byCategory);
		}
	}

	const nodes = new Map<string, SankeyNode>();
	const links: SankeyLink[] = [];
	const node = (id: string, name: string) => {
		if (!nodes.has(id)) {
			nodes.set(id, { id, name });
		}
	};
	node("budget", "Income");

	let totalIncome = 0;
	let totalExpense = 0;
	for (const [payeeId, { name, amount }] of incomes) {
		if (amount <= 0) {
			continue;
		}
		totalIncome += amount;
		if (options.showIncome) {
			node(`payee-${payeeId}`, name);
			links.push({ source: `payee-${payeeId}`, target: "budget", value: amount });
		}
	}

	// A spending category that ended up positive (refunds) feeds the budget like income.
	const positive: SankeyLink[] = [];
	const spending: { groupId: string; total: number; categories: [string, number][] }[] = [];
	for (const [groupId, byCategory] of expenses) {
		let total = 0;
		const spent: [string, number][] = [];
		for (const [categoryId, amount] of byCategory) {
			if (amount > 0) {
				positive.push({ source: `cat-${categoryId}`, target: "budget", value: amount });
				totalIncome += amount;
			} else if (amount < 0) {
				spent.push([categoryId, -amount]);
				total -= amount;
			}
		}
		if (total > 0) {
			totalExpense += total;
			spending.push({ groupId, total, categories: spent.sort((a, b) => b[1] - a[1]) });
		}
	}

	if (positive.length && options.showIncome) {
		if (options.groupPositive) {
			node("positive-cats", "Positive categories");
			const value = positive.reduce((sum, l) => sum + l.value, 0);
			links.push({ source: "positive-cats", target: "budget", value });
		} else {
			for (const link of positive) {
				node(link.source, categories.get(link.source.slice(4))?.name ?? "Unknown");
				links.push(link);
			}
		}
	}

	if (options.showExpense) {
		for (const group of spending.sort((a, b) => b.total - a.total)) {
			node(`group-${group.groupId}`, groups.get(group.groupId)?.name ?? "Unknown group");
			links.push({ source: "budget", target: `group-${group.groupId}`, value: group.total });
			if (options.showSubCategories) {
				for (const [categoryId, value] of group.categories) {
					node(`cat-${categoryId}`, categories.get(categoryId)?.name ?? "Unknown");
					links.push({ source: `group-${group.groupId}`, target: `cat-${categoryId}`, value });
				}
			}
		}
	}

	if (
		options.showLossGain &&
		(options.showExpense || options.showIncome) &&
		totalExpense !== totalIncome
	) {
		if (totalExpense > totalIncome) {
			node("net-loss", "Net loss");
			const link = { source: "net-loss", target: "budget", value: totalExpense - totalIncome };
			// With no income at all, the loss is the only thing feeding the budget; lead with it.
			if (totalIncome === 0) {
				links.unshift(link);
			} else {
				links.push(link);
			}
		} else {
			node("net-gain", "Net gain");
			links.push({ source: "budget", target: "net-gain", value: totalIncome - totalExpense });
		}
	}

	return { nodes: [...nodes.values()], links, total: totalIncome };
}

/** The transactions behind a node: a payee's income, or a category's or group's spending. */
export function transactionsFor(
	{ transactions, categories }: Breakdown,
	nodeId: string,
): BreakdownTransaction[] {
	const [kind, id] = splitNodeId(nodeId);
	return transactions.filter((tx) => {
		const category = tx.category ? categories.get(tx.category) : undefined;
		if (!category) {
			return false;
		}
		if (kind === "payee") {
			return tx.payee === id && category.is_income;
		}
		if (kind === "cat") {
			return category.id === id;
		}
		return kind === "group" && category.group === id && !category.is_income;
	});
}

/** Filters for Actual's All Accounts view, as its own reports pass them. */
export function accountFilters(
	{ categories }: Breakdown,
	{ start, end }: { start: string; end: string },
	nodeId: string,
): Record<string, unknown>[] {
	const conditions: Record<string, unknown>[] = [];
	if (start) {
		conditions.push({ field: "date", op: "gte", value: start, type: "date" });
	}
	if (end) {
		conditions.push({ field: "date", op: "lte", value: end, type: "date" });
	}
	const [kind, id] = splitNodeId(nodeId);
	if (kind === "payee") {
		conditions.push({ field: "payee", op: "is", value: id, type: "id" });
	} else if (kind === "cat") {
		conditions.push({ field: "category", op: "is", value: id, type: "id" });
	} else if (kind === "group") {
		const ids = [...categories.values()]
			.filter((c) => c.group === id && !c.is_income)
			.map((c) => c.id);
		if (ids.length) {
			conditions.push(
				ids.length === 1
					? { field: "category", op: "is", value: ids[0], type: "id" }
					: { field: "category", op: "oneOf", value: ids, type: "id" },
			);
		}
	}
	return conditions;
}

function splitNodeId(nodeId: string): [string, string] {
	const dash = nodeId.indexOf("-");
	return [nodeId.slice(0, dash), nodeId.slice(dash + 1)];
}
