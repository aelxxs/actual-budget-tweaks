import { cellValue } from "@features/readability/category-progress/cells";
import { send } from "@lib/utilities/actual-api";
import { getCurrencyCode } from "@lib/utilities/currency";

/** What an action changed, so its toast can describe and undo it. */
export interface ActionResult {
	message: string;
	/** Entries it added to Actual's undo history; each handler call is one. */
	undoSteps: number;
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

/** Moves each target's shortfall from To Budget into its category. */
export async function fundTargets(sheet: string, short: Shortfall[]): Promise<ActionResult | null> {
	const month = monthOf(sheet);
	const amounts = new Map(short.map((s) => [s.id, s.shortfall]));
	const steps = await whileFunds(sheet, [...amounts.keys()], (category) =>
		send("budget/transfer-available", { month, amount: amounts.get(category), category }),
	);
	return steps
		? { message: `Funded ${plural(steps, "target", "targets")}`, undoSteps: steps }
		: null;
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
	requestAnimationFrame(() => (target as HTMLElement | null)?.click());
}
