import {
	accountIconPicker,
	loadIconCache,
	type AccountIconData,
} from "@features/appearance/account-icon-picker";
import {
	groupOf,
	groupsIn,
	loadGroupState,
	type AccountGroup,
} from "@features/workflows/sidebar/lib/groups";
import { applyOrder, loadAccountOrder } from "@features/workflows/sidebar/lib/order";
import type { Account, Category, CategoryGroup } from "@lib/types/actual-schema";
import { loadCurrentBudgetId } from "@lib/utilities/actual-api";
import { getValue } from "@lib/utilities/store";
import type { TreeSection } from "./FilterTree.svelte";

export type FilterAccount = Pick<Account, "id" | "name" | "offbudget" | "closed">;

/** ABT's sidebar icons, groups and order, so the account list reads like the sidebar. */
export interface AccountLayout {
	icons: Record<string, AccountIconData>;
	groups: Record<string, AccountGroup>;
	assignments: Record<string, string>;
	order: string[];
}

export async function loadAccountLayout(): Promise<AccountLayout> {
	const budgetId = await loadCurrentBudgetId();
	const [iconsOn, icons, { groups, assignments }, order] = await Promise.all([
		getValue(accountIconPicker.context.key, accountIconPicker.context.defaultValue),
		loadIconCache().catch(() => ({})),
		loadGroupState(budgetId),
		loadAccountOrder(budgetId),
	]);
	return { icons: iconsOn ? icons : {}, groups, assignments, order };
}

export function accountSections(
	accounts: FilterAccount[],
	layout: AccountLayout,
	hideOffBudget: boolean,
): TreeSection<FilterAccount>[] {
	const open = applyOrder(
		accounts.filter((a) => !a.closed && !(hideOffBudget && a.offbudget)),
		layout.order,
	);
	const bucketOf = (a: FilterAccount) => groupOf(a, layout.assignments, layout.groups);

	return (["onbudget", "offbudget"] as const).map((kind) => {
		const inSection = open.filter((a) => a.offbudget === (kind === "offbudget"));
		return {
			id: kind,
			label: kind === "onbudget" ? "On Budget" : "Off Budget",
			items: inSection.filter((a) => !bucketOf(a)),
			groups: groupsIn(kind, layout, open).map((g) => ({
				id: g.id,
				label: g.label,
				items: inSection.filter((a) => bucketOf(a) === g.id),
			})),
		};
	});
}

export function categorySections(
	groups: Pick<CategoryGroup, "id" | "name">[],
	categories: Pick<Category, "id" | "name" | "group">[],
): TreeSection[] {
	return groups.map((g) => ({
		id: g.id,
		label: g.name,
		items: categories.filter((c) => c.group === g.id),
		groups: [],
	}));
}
