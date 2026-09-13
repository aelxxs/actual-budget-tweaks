import { send } from "@lib/utilities/actual-api";
import { loadTemplatesByCategoryId } from "./actual-data";
import { isRemainderTemplate } from "./templates";

const CONCURRENCY = 8;

/** Preview saved templates without applying them or reading stale goal cells. */
export async function previewMonthTemplateTotal(
	month: string,
	categories: { id: string }[],
): Promise<number | null> {
	try {
		const templatesByCategory = await loadTemplatesByCategoryId(true);
		let total = 0;
		// Bound bridge traffic for budgets with many categories.
		for (let start = 0; start < categories.length; start += CONCURRENCY) {
			const amounts = await Promise.all(
				categories.slice(start, start + CONCURRENCY).map(async ({ id }) => {
					// Remainder rules distribute spare funds; they have no funding target.
					const templates = (templatesByCategory.get(id) ?? [])
						.filter((entry) => !isRemainderTemplate(entry))
						.map((entry) => entry.engineTemplate);
					if (templates.length === 0) return 0;
					const result = await send("budget/dry-run-category-template", {
						month,
						categoryId: id,
						templates,
					});
					if (!result || !Number.isFinite(result.budgeted)) {
						throw new Error("Template preview did not return a funding amount");
					}
					return Math.max(0, result.budgeted);
				}),
			);
			total += amounts.reduce((sum, amount) => sum + amount, 0);
		}
		return total;
	} catch (error) {
		console.warn("[ABT] next-month template preview failed", error);
		// Never present a partial target or silently fall back to applied goals.
		return null;
	}
}
