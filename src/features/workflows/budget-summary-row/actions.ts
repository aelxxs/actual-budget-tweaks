import { send } from "@lib/utilities/actual-api";
import { readCell } from "@lib/utilities/budget-cells";
import { getCurrencyCode } from "@lib/utilities/currency";
import { CELL, leftoverCellOf } from "@lib/actual-dom";
import { loadTemplatesByCategoryId } from "@lib/template-plan/actual-data";
import { comparePriority, type PriorityValue } from "@lib/template-plan/constants";
import { isRemainderTemplate } from "@lib/template-plan/templates";

/** What an action changed, so its toast can describe and undo it. */
export interface ActionResult {
	message: string;
	/** Entries it added to Actual's undo history; each handler call is one. */
	undoSteps: number;
	/** Actual's details for template errors or warnings, one per line. */
	detail?: string;
}

export interface Shortfall {
	id: string;
	shortfall: number;
}

export const monthOf = (sheet: string) => `${sheet.slice(6, 10)}-${sheet.slice(10, 12)}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Runs `step` per category while To Budget has money; Actual caps each step at what's left. */
async function whileFunds(sheet: string, ids: string[], step: (id: string) => Promise<unknown>) {
	let steps = 0;
	for (const id of ids) {
		if ((await readCell(sheet, "to-budget", 0)) <= 0) {
			break;
		}
		await step(id);
		steps++;
	}
	return steps;
}

/** Actual's own Cover overspending, from To Budget, for every red category. */
export async function coverOverspending(
	sheet: string,
	overIds: string[],
): Promise<ActionResult | null> {
	const month = monthOf(sheet);
	const currencyCode = getCurrencyCode();
	const steps = await whileFunds(sheet, overIds, (to) =>
		send("budget/cover-overspending", { month, to, from: "to-budget", currencyCode }),
	);
	return steps
		? {
				message: `Covered overspending in ${plural(steps, "category", "categories")}`,
				undoSteps: steps,
			}
		: null;
}

/** Part of a category's shortfall, at the priority of the template it belongs to. */
interface Piece {
	id: string;
	priority: PriorityValue;
	amount: number;
	/** The category's place in the table, which breaks ties within a priority like Actual. */
	index: number;
}

/**
 * Splits each shortfall by template priority. The current budget covers templates in priority
 * order, as when Actual applies them, so what's left is the later templates' share; any
 * shortfall the templates don't explain (a `#goal` balance) comes last.
 */
async function shortfallPieces(sheet: string, short: Shortfall[]): Promise<Piece[]> {
	const month = monthOf(sheet);
	const templates = await loadTemplatesByCategoryId().catch(() => new Map<string, never[]>());
	const pieces = await Promise.all(
		short.map(async ({ id, shortfall }, index) => {
			const entries = (templates.get(id) ?? [])
				.filter((t) => t.engineTemplate && !isRemainderTemplate(t))
				.sort((a, b) => comparePriority(a.priority, b.priority));
			const [dry, budgeted] = await Promise.all([
				entries.length
					? send("budget/dry-run-category-template", {
							month,
							categoryId: id,
							templates: entries.map((t) => t.engineTemplate),
						}).catch(() => null)
					: null,
				readCell(sheet, `budget-${id}`, 0),
			]);
			const out: Piece[] = [];
			let covered = budgeted;
			let need = shortfall;
			entries.forEach((t, i) => {
				const demand = Math.max(0, dry?.perTemplate?.[i] ?? 0);
				const fromBudget = Math.min(demand, Math.max(0, covered));
				covered -= fromBudget;
				const amount = Math.min(demand - fromBudget, need);
				if (amount > 0) {
					out.push({ id, priority: t.priority, amount, index });
					need -= amount;
				}
			});
			if (need > 0) {
				out.push({ id, priority: null, amount: need, index });
			}
			return out;
		}),
	);
	return pieces.flat().sort((a, b) => comparePriority(a.priority, b.priority) || a.index - b.index);
}

/**
 * Moves each target's shortfall from To Budget, by template priority when To Budget runs short.
 * Not Actual's apply-multiple-templates: that re-runs the templates over To Budget plus what
 * the categories already hold, so a short month takes money back from lower priorities.
 */
export async function fundTargets(sheet: string, short: Shortfall[]): Promise<ActionResult | null> {
	let left = await readCell(sheet, "to-budget", 0);
	const needs = short.reduce((t, s) => t + s.shortfall, 0);
	if (!short.length || left <= 0 || needs <= 0) {
		return null;
	}
	// Order only matters when there isn't enough for every target.
	const pieces =
		left >= needs
			? short.map(({ id, shortfall }, index) => ({ id, priority: null, amount: shortfall, index }))
			: await shortfallPieces(sheet, short);
	const adds = new Map<string, number>();
	for (const piece of pieces) {
		if (left <= 0) {
			break;
		}
		const amount = Math.min(piece.amount, left);
		adds.set(piece.id, (adds.get(piece.id) ?? 0) + amount);
		left -= amount;
	}
	const month = monthOf(sheet);
	for (const [category, amount] of adds) {
		const budgeted = await readCell(sheet, `budget-${category}`, 0);
		await send("budget/budget-amount", { month, category, amount: budgeted + amount });
	}
	const full = short.filter((s) => (adds.get(s.id) ?? 0) >= s.shortfall).length;
	const partial = adds.size - full;
	const total = plural(short.length, "target", "targets");
	const message =
		full === short.length
			? `Funded ${total}`
			: full
				? `Funded ${full} of ${total}${partial ? `, and part of ${partial} more` : ""}`
				: `Funded part of ${plural(partial, "target", "targets")}`;
	return { message, undoSteps: adds.size };
}

export const BULK_ACTIONS = {
	"copy-previous-month": "Budgets set to last month's amounts",
	"set-3month-avg": "Budgets set to the 3-month average",
	"set-6month-avg": "Budgets set to the 6-month average",
	"set-12month-avg": "Budgets set to the 12-month average",
	"set-zero": "Budgets set to zero",
} as const;

export type BulkAction = keyof typeof BULK_ACTIONS;

/** Actual's month-menu actions: one call, one undo entry. */
export async function runBulk(sheet: string, action: BulkAction): Promise<ActionResult> {
	await send(`budget/${action}`, { month: monthOf(sheet) });
	return { message: BULK_ACTIONS[action], undoSteps: 1 };
}

/** The server's undo, awaited per step; the client's undo() is throttled and drops rapid calls. */
export async function undoSteps(steps: number): Promise<void> {
	for (let i = 0; i < steps; i++) {
		await send("undo");
	}
}

/** Opens Actual's own To Budget menu, which is where over-assigning gets fixed. */
export function openToBudgetMenu(toBudgetCard: Element | null | undefined): void {
	const target = toBudgetCard?.querySelector<HTMLElement>(CELL) ?? toBudgetCard;
	// That menu closes when focus is outside it, and the clicked card button still holds focus.
	(document.activeElement as HTMLElement | null)?.blur();
	(target as HTMLElement | null)?.click();
}

/**
 * Opens Actual's balance menu for an overspent category, whose Cover overspending takes the money
 * from a category you pick. False when the row isn't rendered (its group is collapsed).
 */
export function coverFromCategory(sheet: string, id: string): boolean {
	const button = document.querySelector(leftoverCellOf(sheet, id))?.closest<HTMLElement>("button");
	if (!button) {
		return false;
	}
	// The menu closes when focus is outside it, and the clicked card button still holds focus.
	(document.activeElement as HTMLElement | null)?.blur();
	button.scrollIntoView({ block: "nearest" });
	button.click();
	return true;
}

export type TemplateAction =
	"apply-goal-template" | "overwrite-goal-template" | "cleanup-goal-template" | "check-templates";

interface TemplateNotification {
	message: string;
	pre?: string;
	count?: number;
}

// Actual's own wording for its template results, which it returns as keys.
const TEMPLATE_MESSAGES: Record<string, (n: TemplateNotification) => string> = {
	"templates-up-to-date": () => "Everything is up to date",
	"template-errors": () => "Some templates couldn't be read",
	"templates-applied": (n) =>
		`Applied templates to ${plural(n.count ?? 0, "category", "categories")}`,
	"templates-check-passed": () => "All templates passed",
	"cleanup-no-funds": () => "Not enough funds for cleanup",
	"cleanup-up-to-date": () => "All categories were up to date",
	"cleanup-applied": () => "End of month cleanup applied",
	"cleanup-applied-with-errors": () => "Cleanup applied, with some errors",
};

/** Actual's month-menu template actions, run the same way its menu does. */
export async function runTemplate(sheet: string, action: TemplateAction): Promise<ActionResult> {
	const result = await send<TemplateNotification | null>(`budget/${action}`, {
		month: monthOf(sheet),
	});
	return {
		message: (result && TEMPLATE_MESSAGES[result.message]?.(result)) ?? "Done",
		undoSteps: action === "check-templates" ? 0 : 1,
		detail: result?.pre,
	};
}

let templatesFlag: Promise<boolean> | null = null;

/** Whether Actual's goal templates are on, which is when its menu shows these. */
export function templatesEnabled(): Promise<boolean> {
	templatesFlag ??= send<Record<string, string>>("preferences/get")
		.then((prefs) => prefs?.["flags.goalTemplatesEnabled"] === "true")
		.catch(() => false);
	return templatesFlag;
}
