import { send } from "@lib/utilities/actual-api";
import { loadTemplatesByCategoryId } from "./actual-data";
import { isRemainderTemplate } from "./templates";

const CONCURRENCY = 8;

/** Preview remaining template funding after the requested month's assignments. */
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
					const [result, assignedCell] = await Promise.all([
						send("budget/dry-run-category-template", {
							month,
							categoryId: id,
							templates,
						}),
						send("get-cell", {
							sheetName: `budget${month.replace("-", "")}`,
							name: `budget-${id}`,
						}),
					]);
					if (!result || !Number.isFinite(result.budgeted)) {
						throw new Error("Template preview did not return a funding amount");
					}
					// Empty cells are unassigned; failed reads must not look like zero.
					const value: unknown = assignedCell?.value;
					const assigned = value === "" ? 0 : value;
					if (typeof assigned !== "number" || !Number.isFinite(assigned)) {
						throw new Error("Could not read existing template funding");
					}
					// The preview is the final assignment, not an additional amount.
					// Clamp each category so excess cannot cover a different goal.
					return Math.max(0, result.budgeted - assigned);
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
