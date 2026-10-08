import { getValue, setValue, watchValue } from "@lib/utilities/store";

const ORDER_KEY = "experimental-sidebar-account-order";

/** A flat, extension-local custom order across all accounts — Actual has no
 * native concept of a custom sidebar order, so this is purely local state,
 * same storage pattern as account-icon-picker's per-account cache. Scoped by
 * budget since account ids aren't unique across different budget files. */
export async function loadAccountOrder(budgetId: string | undefined): Promise<string[]> {
	return getValue<string[]>(budgetId ? `${ORDER_KEY}:${budgetId}` : ORDER_KEY, []);
}

export function saveAccountOrder(budgetId: string | undefined, order: string[]): void {
	setValue(budgetId ? `${ORDER_KEY}:${budgetId}` : ORDER_KEY, order);
}

/** Follows order changes made elsewhere, such as another device's, adopted by settings sync. */
export function watchAccountOrder(
	budgetId: string | undefined,
	callback: (order: string[]) => void,
): () => void {
	return watchValue<string[]>(budgetId ? `${ORDER_KEY}:${budgetId}` : ORDER_KEY, (v) =>
		callback(v ?? []),
	);
}

/** Sorts `items` by their position in `order`; anything not listed keeps its
 * original relative position, appended after everything that is listed. */
export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
	const index = new Map(order.map((id, i) => [id, i]));
	return [...items].sort((a, b) => {
		const ai = index.has(a.id) ? index.get(a.id)! : Infinity;
		const bi = index.has(b.id) ? index.get(b.id)! : Infinity;
		if (ai === bi) return 0;
		return ai - bi;
	});
}
