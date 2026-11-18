import type { GoalDefEntry } from "@lib/types/actual-schema";
import { REMAINDER_PRIORITY } from "./constants";

export type TemplatePriority = number | null | undefined;

/** ABT's grouping of Actual's template directives; "upto" is a simple template with only a limit. */
export type TemplateKind =
	| "simple"
	| "upto"
	| "schedule"
	| "average"
	| "periodic"
	| "by"
	| "spend"
	| "percentage"
	| "copy"
	| "remainder"
	| "unknown";

export interface TemplateEntry {
	priority: TemplatePriority;
	kind?: TemplateKind;
	amount?: number;
	cap?: number;
	weight?: number;
	raw?: unknown;
	engineTemplate?: unknown;
}

/** A category's `goal_def` column: its template and goal directives, parsed. */
export function parseGoalDef(goalDef: string | null | undefined): GoalDefEntry[] {
	if (!goalDef) {
		return [];
	}
	try {
		const parsed = JSON.parse(goalDef);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(
			(d): d is GoalDefEntry => d && (d.directive === "template" || d.directive === "goal"),
		);
	} catch {
		return [];
	}
}

/**
 * Converts a category's parsed `goal_def` directives into the TemplateEntry
 * shape the priority planner consumes. `goal_def` is already Actual's own
 * structured template-engine format — the same shape `budget/dry-run-category-template`
 * expects — so `engineTemplate` is simply the directive itself, no note-text
 * parsing required. Standalone savings-goal directives (`directive: "goal"`)
 * aren't a budgeting instruction and are excluded, matching this planner's
 * prior scope.
 */
export function templateEntriesFromGoalDef(entries: GoalDefEntry[]): TemplateEntry[] {
	const out: TemplateEntry[] = [];
	for (const d of entries) {
		if (d.directive === "goal") {
			continue;
		}

		switch (d.type) {
			case "simple": {
				const isUpto = d.monthly == null && !!d.limit;
				out.push({
					kind: isUpto ? "upto" : "simple",
					priority: d.priority,
					amount: d.monthly ?? undefined,
					cap: d.limit?.amount,
					engineTemplate: d,
				});
				break;
			}
			case "schedule":
				out.push({ kind: "schedule", priority: d.priority, engineTemplate: d });
				break;
			case "average":
				out.push({ kind: "average", priority: d.priority, engineTemplate: d });
				break;
			case "periodic":
				out.push({ kind: "periodic", priority: d.priority, amount: d.amount, engineTemplate: d });
				break;
			case "by":
				out.push({ kind: "by", priority: d.priority, amount: d.amount, engineTemplate: d });
				break;
			case "spend":
				out.push({ kind: "spend", priority: d.priority, amount: d.amount, engineTemplate: d });
				break;
			case "percentage":
				out.push({ kind: "percentage", priority: d.priority, engineTemplate: d });
				break;
			case "copy":
				out.push({ kind: "copy", priority: d.priority, engineTemplate: d });
				break;
			case "remainder":
				out.push({
					kind: "remainder",
					priority: REMAINDER_PRIORITY,
					weight: d.weight,
					engineTemplate: d,
				});
				break;
			case "limit":
			case "refill":
				// "Automate budget" directives — no client-side demand estimate is
				// attempted for these; the dry-run engine (which receives
				// engineTemplate) is the only source of truth for their combined
				// effect, since a lone "limit" (no paired "refill") is just a
				// spending cap, not an active budgeting instruction.
				out.push({ kind: "unknown", priority: d.priority, engineTemplate: d });
				break;
		}
	}
	return out;
}

export function isRemainderTemplate(t: TemplateEntry): boolean {
	return !!t && t.kind === "remainder";
}
