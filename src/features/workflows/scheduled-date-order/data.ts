/** The fields of Actual's transaction rows this reads; split children follow their parent. */
export type Row = {
	id: string;
	date: string;
	amount: number;
	parent_id?: string | null;
};
export type Balances = Record<string, number>;
export type SortDir = "asc" | "desc";

/** Actual's ids for upcoming scheduled transactions contain "preview/". */
export const isScheduled = (row: Row) => row.id.includes("preview/");

// A transaction is its own row and, for a split, the children right after it.
function groupSplits(rows: readonly Row[]): Row[][] {
	const groups: Row[][] = [];
	for (const row of rows) {
		const last = groups.at(-1);
		if (last && row.parent_id && row.parent_id === last[0].id) {
			last.push(row);
		} else {
			groups.push([row]);
		}
	}
	return groups;
}

/**
 * Actual's list with its scheduled transactions (always on top, newest first) moved in among the
 * rest by date. On the same day a scheduled one stays the later of the two, as Actual has it.
 */
function mergeByDate(groups: Row[][], dir: SortDir): Row[][] {
	const scheduled = groups.filter((g) => isScheduled(g[0]));
	const real = groups.filter((g) => !isScheduled(g[0]));
	if (dir === "asc") {
		scheduled.reverse();
	}
	const merged: Row[][] = [];
	let s = 0;
	let r = 0;
	while (s < scheduled.length || r < real.length) {
		const next =
			r >= real.length ||
			(s < scheduled.length &&
				(dir === "desc"
					? scheduled[s][0].date >= real[r][0].date
					: scheduled[s][0].date < real[r][0].date));
		merged.push(next ? scheduled[s++] : real[r++]);
	}
	return merged;
}

/**
 * Running balances for the new order. Actual stacks every scheduled amount on the current balance;
 * here each one counts from the transaction before it in time, and pushes up the ones after it.
 */
function rebalance(merged: Row[][], balances: Balances, dir: SortDir): Balances {
	const oldestFirst = dir === "asc" ? merged : merged.toReversed();
	const first = oldestFirst.find((g) => !isScheduled(g[0]) && balances[g[0].id] != null)?.[0];
	if (!first) {
		return balances;
	}
	const out = { ...balances };
	let base = balances[first.id] - first.amount;
	let scheduledSum = 0;
	for (const [row] of oldestFirst) {
		if (isScheduled(row)) {
			scheduledSum += row.amount;
			out[row.id] = base + scheduledSum;
		} else if (balances[row.id] != null) {
			base = balances[row.id];
			out[row.id] = base + scheduledSum;
		}
	}
	return out;
}

/**
 * The rows and balances Actual's account view shows, with scheduled transactions in date order.
 * Hands back the same objects when there's nothing to move.
 */
export function interleaveScheduled<T extends Row>(
	rows: readonly T[],
	balances: Balances | null,
	dir: SortDir,
): { rows: readonly T[]; balances: Balances | null } {
	if (!rows.some(isScheduled)) {
		return { rows, balances };
	}
	const merged = mergeByDate(groupSplits(rows), dir);
	return {
		rows: merged.flat() as T[],
		balances: balances ? rebalance(merged, balances, dir) : null,
	};
}
