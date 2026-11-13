import { send } from "@lib/actual/actual-api";
import { monthToSheet } from "@lib/format/months";
import { loadTemplatesByCategoryId } from "./actual-data";
import { isRemainderTemplate, type TemplateEntry } from "./templates";
import { createLogger } from "@lib/logger";

const log = createLogger("template-plan");

const CONCURRENCY = 8;

/** Preview remaining template funding after the requested month's assignments. */
export async function previewMonthTemplateTotal(
	month: string,
	categories: { id: string }[],
	templates?: Map<string, TemplateEntry[]>,
): Promise<number | null> {
	return (await previewMonthTemplates(month, categories, templates))?.remaining ?? null;
}

/**
 * What templates still need this month (`remaining`), and how much of it Apply would assign
 * (`onApply`): Apply skips categories that already have money assigned, unlike Overwrite.
 */
export async function previewMonthTemplates(
	month: string,
	categories: { id: string }[],
	/** Already loaded, for previewing several months at once. */
	templates?: Map<string, TemplateEntry[]>,
): Promise<{ remaining: number; onApply: number } | null> {
	try {
		const templatesByCategory = templates ?? (await loadTemplatesByCategoryId(true));
		let remaining = 0;
		let onApply = 0;
		// Bound bridge traffic for budgets with many categories.
		for (let start = 0; start < categories.length; start += CONCURRENCY) {
			const amounts = await Promise.all(
				categories.slice(start, start + CONCURRENCY).map(async ({ id }) => {
					// Remainder rules distribute spare funds; they have no funding target.
					const templates = (templatesByCategory.get(id) ?? [])
						.filter((entry) => !isRemainderTemplate(entry))
						.map((entry) => entry.engineTemplate);
					if (templates.length === 0) {
						return { need: 0, assigned: 0 };
					}
					const [result, assignedCell] = await Promise.all([
						send("budget/dry-run-category-template", {
							month,
							categoryId: id,
							templates,
						}),
						send("get-cell", {
							sheetName: monthToSheet(month),
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
					return { need: Math.max(0, result.budgeted - assigned), assigned };
				}),
			);
			for (const { need, assigned } of amounts) {
				remaining += need;
				if (assigned === 0) {
					onApply += need;
				}
			}
		}
		return { remaining, onApply };
	} catch (error) {
		log.warn("next-month template preview failed", error);
		// Never present a partial target or silently fall back to applied goals.
		return null;
	}
}
