import { query } from "./actual-api";
import { parseMoney } from "./currency";

export interface BudgetMove {
	amount: number;
	/** Category ids, or null for To Budget, Overbudgeted, or a name that no longer matches one. */
	fromId: string | null;
	toId: string | null;
	from: string;
	to: string;
	/** As Actual wrote it, e.g. "October 21". */
	day: string;
}

/*
 * Actual logs each move made from its cover and transfer menus as a line in the month's budget
 * notes, always in English. It names categories rather than ids, so a renamed category's older
 * lines go unmatched, and an amount typed straight into a cell is never logged.
 */
const LINE_RE = /^-\s*Reassigned (.+?) from (.+?) → (.+?) on (.+)$/;

/** This month's logged moves; `month` is "2026-10". */
export async function loadMonthMoves(month: string): Promise<BudgetMove[]> {
	const [notes, categories] = await Promise.all([
		query<{ id: string; note: string | null }[]>("notes", { filter: { id: `budget-${month}` } }),
		query<{ id: string; name: string; tombstone: boolean }[]>("categories"),
	]);
	const text = notes?.[0]?.note;
	if (!text) {
		return [];
	}
	const idByName = new Map<string, string>();
	for (const c of categories) {
		if (!c.tombstone && !idByName.has(c.name)) {
			idByName.set(c.name, c.id);
		}
	}
	const moves: BudgetMove[] = [];
	for (const line of text.split("\n")) {
		const m = line.trim().match(LINE_RE);
		const amount = m ? parseMoney(m[1]) : null;
		if (!m || amount == null || amount <= 0) {
			continue;
		}
		const [, , from, to, day] = m;
		moves.push({
			amount,
			fromId: idByName.get(from) ?? null,
			toId: idByName.get(to) ?? null,
			from,
			to,
			day,
		});
	}
	return moves;
}

/** What each category gave away this month, by id. */
export function movedOutById(moves: BudgetMove[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const move of moves) {
		if (move.fromId) {
			out.set(move.fromId, (out.get(move.fromId) ?? 0) + move.amount);
		}
	}
	return out;
}
