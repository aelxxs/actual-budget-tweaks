/** A column of the schedules table that sorts in the backend's query. */
export type SortColumn = "name" | "next_date";
export type SortOrder = { column: SortColumn; dir: "asc" | "desc" };

export const SORT_COLUMNS: readonly SortColumn[] = ["name", "next_date"];

/** A stored value, or null (Actual's own order) when it isn't one this version reads. */
export function readOrder(value: unknown): SortOrder | null {
	const { column, dir } = (value ?? {}) as Partial<SortOrder>;
	return SORT_COLUMNS.includes(column as SortColumn) && (dir === "asc" || dir === "desc")
		? { column: column as SortColumn, dir }
		: null;
}

/** A click on a column: the same one flips its direction, another starts ascending. */
export function nextOrder(current: SortOrder | null, column: SortColumn): SortOrder {
	if (current?.column === column) {
		return { column, dir: current.dir === "asc" ? "desc" : "asc" };
	}
	return { column, dir: "asc" };
}

const BY_NAME = (dir: string) => ({ $lower: "$name", $dir: dir });

/** The AQL order for it: names ignore case, and each column breaks ties with the other. */
export function orderExpressions(order: SortOrder): Record<string, unknown>[] {
	return order.column === "name"
		? [BY_NAME(order.dir), { next_date: "asc" }]
		: [{ next_date: order.dir }, BY_NAME("asc")];
}
