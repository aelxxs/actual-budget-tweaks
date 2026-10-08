import { query, send } from "@lib/utilities/actual-api";
import type { Category, CategoryGroup } from "@lib/types/actual-schema";

export interface RecapTransaction {
	id: string;
	date: string;
	amount: number;
	payee: string;
	account: string;
	accountName: string;
	category: string | null;
	/** Transfers, splits and off-budget accounts take no category. */
	needsCategory: boolean;
}

export interface RecapGroup {
	id: string;
	name: string;
	categories: { id: string; name: string }[];
}

interface Row {
	id: string;
	date: string;
	amount: number;
	category: string | null;
	transfer_id: string | null;
	is_parent: boolean;
	account: string;
	payeeName: string | null;
	importedPayee: string | null;
	accountName: string;
	offbudget: boolean;
}

export async function loadTransactions(ids: string[]): Promise<RecapTransaction[]> {
	if (!ids.length) return [];
	const rows = await query<Row[]>("transactions", {
		filter: { id: { $oneof: ids } },
		select: [
			"id",
			"date",
			"amount",
			"category",
			"transfer_id",
			"is_parent",
			"account",
			{ payeeName: "payee.name" },
			{ importedPayee: "imported_payee" },
			{ accountName: "account.name" },
			{ offbudget: "account.offbudget" },
		],
		options: { splits: "none" },
	});
	return rows
		.map((r) => ({
			id: r.id,
			date: r.date,
			amount: r.amount,
			payee: r.payeeName || r.importedPayee || "Unknown payee",
			account: r.account,
			accountName: r.accountName,
			category: r.category,
			needsCategory: !r.transfer_id && !r.is_parent && !r.offbudget,
		}))
		.sort((a, b) => b.date.localeCompare(a.date));
}

/** Visible categories, grouped and ordered as the budget shows them. */
export async function loadCategoryGroups(): Promise<RecapGroup[]> {
	const [groups, cats] = await Promise.all([
		query<CategoryGroup[]>("category_groups"),
		query<Category[]>("categories"),
	]);
	const bySort = (a: { sort_order?: number }, b: { sort_order?: number }) =>
		(a.sort_order ?? 0) - (b.sort_order ?? 0);
	return groups
		.filter((g) => !g.tombstone)
		.sort(bySort)
		.map((g) => ({
			id: g.id,
			name: g.name,
			categories: cats
				.filter((c) => c.group === g.id && !c.tombstone && !c.hidden)
				.sort(bySort)
				.map((c) => ({ id: c.id, name: c.name })),
		}))
		.filter((g) => g.categories.length > 0);
}

export async function setCategory(id: string, category: string): Promise<void> {
	await send("transactions-batch-update", { updated: [{ id, category }] });
}
