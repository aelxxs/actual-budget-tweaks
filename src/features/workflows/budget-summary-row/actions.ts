import { cellValue } from "@features/readability/category-progress/cells";
import { send } from "@lib/utilities/actual-api";
import { getCurrencyCode } from "@lib/utilities/currency";

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
		if ((await cellValue(sheet, "to-budget")) <= 0) break;
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

/**
 * Funds the underfunded targets by applying just those categories' templates, which is where
 * targets come from: one call and one undo step however many there are, and when To Budget
 * runs short Actual funds them in template priority order.
 */
export async function fundTargets(sheet: string, short: Shortfall[]): Promise<ActionResult | null> {
	if (!short.length) return null;
	const result = await send<TemplateNotification | null>("budget/apply-multiple-templates", {
		month: monthOf(sheet),
		categoryIds: short.map((s) => s.id),
	});
	const message =
		result?.message === "template-errors" || result?.message === "templates-up-to-date"
			? TEMPLATE_MESSAGES[result.message](result)
			: `Funded ${plural(result?.count ?? short.length, "target", "targets")}`;
	return { message, undoSteps: 1, detail: result?.pre };
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
	for (let i = 0; i < steps; i++) await send("undo");
}

/** Opens Actual's own To Budget menu, which is where over-assigning gets fixed. */
export function openToBudgetMenu(toBudgetCard: Element | null | undefined): void {
	const target = toBudgetCard?.querySelector<HTMLElement>("[data-cellname]") ?? toBudgetCard;
	// That menu closes when focus is outside it, and the clicked card button still holds focus.
	(document.activeElement as HTMLElement | null)?.blur();
	(target as HTMLElement | null)?.click();
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
