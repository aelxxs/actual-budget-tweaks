/**
 * Global window augmentations for Actual Budget's internal APIs.
 * These are only available in the main world (actual-api-bridge-main.ts
 * and src/lib/main-world/legacy/).
 *
 * Do NOT use these directly in content scripts — use the typed bridge
 * functions in @lib/utilities/actual-api instead.
 */

import type { ActualTable, TableName } from "./actual-schema";

/** Minimal AQL query builder returned by window.$q() */
interface AQLQuery {
  filter(conditions: Record<string, unknown>): AQLQuery;
  select(fields: string | string[]): AQLQuery;
}

/** Result shape returned by window.$query() */
interface AQLQueryResult<T> {
  data: T[];
}

declare global {
  interface Window {
    /**
     * Actual Budget's internal query executor.
     * Accepts a query built with $q() and returns the matching rows.
     *
     * Available in the main world only. Use query() from @lib/utilities/actual-api
     * in content scripts.
     */
    $query: (<T extends TableName>(
      query: AQLQuery,
    ) => Promise<AQLQueryResult<ActualTable[T]>>) &
      ((query: AQLQuery) => Promise<AQLQueryResult<Record<string, unknown>>>) | undefined;

    /**
     * Actual Budget's internal AQL query builder factory.
     *
     * @example
     * window.$q("categories").filter({ tombstone: false }).select("*")
     */
    $q: ((table: TableName) => AQLQuery) &
      ((table: string) => AQLQuery) | undefined;

    /**
     * Actual Budget's internal send/mutation API.
     * Used for budget cell reads, mutations, and dashboard operations.
     *
     * @example
     * window.$send("get-cell", { sheetName: "budget202506", name: "available-funds" })
     */
    $send: ((method: string, args?: unknown) => Promise<unknown>) | undefined;

    /**
     * Actual Budget's internal SPA navigation function.
     * Injected by Actual — not always present.
     */
    __navigate: ((path: string, options?: Record<string, unknown>) => void) | undefined;

    /**
     * TanStack Query client instance — used by income-breakdown to
     * invalidate dashboard queries after mutations.
     */
    __TANSTACK_QUERY_CLIENT__: {
      invalidateQueries: (options: { queryKey: unknown[] }) => void;
    } | undefined;
  }
}

export {};
