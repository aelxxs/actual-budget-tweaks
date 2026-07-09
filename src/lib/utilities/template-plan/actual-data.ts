import { query, send } from "@lib/utilities/actual-api";
import type { GoalDefEntry } from "@lib/types/actual-schema";
import { Page, matchesPage } from "@lib/utilities/pages";
import type { Category } from "./priority-plan";
import { templateEntriesFromGoalDef } from "./templates";
import type { TemplateEntry } from "./templates";

export interface SnapshotDescriptor {
	sheet: string;
	ids: string[];
	promises: Promise<{ value: number } | null>[];
}

export interface SnapshotResult {
	sheet: string;
	availableFunds: number;
	toBudget: number;
	budgets: Map<string, number>;
}

// ── Categories cache ─────────────────────────────────────────────────
let categoriesCache: Category[] | null = null;
let categoriesPromise: Promise<Category[]> | null = null;

// ── Backend readiness ────────────────────────────────────────────────
// query()/send() already wait on the API bridge internally (waitForBudget),
// so readiness here just needs to confirm the budget page has rendered.
export function isBackendReady(): boolean {
	if (!document.querySelector('a[href="/budget"]')) return false;
	return !!document.querySelector('[data-testid^="budget2"][data-testid*="!sum-amount-"]');
}

export function waitForBackendReady(): Promise<void> {
	return new Promise<void>((resolve) => {
		if (isBackendReady()) {
			resolve();
			return;
		}
		const tick = () => {
			if (isBackendReady()) {
				resolve();
				return;
			}
			setTimeout(tick, 200);
		};
		tick();
	});
}

export async function loadCategories(force?: boolean): Promise<Category[]> {
	if (!isBackendReady()) {
		await waitForBackendReady();
	}
	if (!force && categoriesCache) return categoriesCache;
	if (!force && categoriesPromise) return categoriesPromise;
	categoriesPromise = (async () => {
		try {
			const [cats, groups] = await Promise.all([query("categories"), query("category_groups")]);
			const groupMap = new Map(groups.map((g) => [g.id, g]));
			categoriesCache = cats
				.filter((c) => !c.tombstone)
				.map((c): Category => {
					const g = groupMap.get(c.group);
					return {
						id: c.id,
						name: c.name,
						sort_order: c.sort_order || 0,
						hidden: !!c.hidden,
						group_name: g?.name || "Uncategorized",
						group_sort_order: g?.sort_order || 0,
					};
				});
		} catch (e) {
			console.warn("[ABT TAB] categories query failed", e);
			if (!categoriesCache) categoriesCache = [];
		}
		return categoriesCache!;
	})();
	return categoriesPromise;
}

export function invalidateCategoriesCache(): void {
	categoriesPromise = null;
	loadCategories(true);
	// Note: deliberately does NOT invalidate priorityCache — category metadata
	// (names/groups) changing doesn't affect goal/budget cell values. Priority
	// cache is invalidated on apply/overwrite and by its TTL.
}

// ── Cell reads ───────────────────────────────────────────────────────
export async function getCells(sheet: string, names: string[]): Promise<Map<string, number>> {
	const results = await Promise.all(
		names.map((n) => send("get-cell", { sheetName: sheet, name: n }).catch(() => null)),
	);
	const map = new Map<string, number>();
	names.forEach((n, i) => {
		const r = results[i];
		map.set(n, r && typeof r.value === "number" ? r.value : 0);
	});
	return map;
}

// SYNC: posts all get-cell messages immediately and returns a descriptor
// with the in-flight promises. Must be callable from a click capture
// handler so the worker queues these reads BEFORE React's bubble-phase
// onClick posts the apply-template message.
export function startSnapshotMonth(sheet: string, cats: Category[]): SnapshotDescriptor {
	const ids = cats.filter((c) => !c.hidden).map((c) => c.id);
	const promises = [
		send("get-cell", { sheetName: sheet, name: "available-funds" }),
		send("get-cell", { sheetName: sheet, name: "to-budget" }),
		...ids.map((id) => send("get-cell", { sheetName: sheet, name: "budget-" + id })),
	];
	return { sheet, ids, promises };
}

export async function awaitSnapshotMonth(start: SnapshotDescriptor): Promise<SnapshotResult> {
	const vals = await Promise.all(start.promises.map((p) => p.catch(() => null)));
	const v = (cell: { value: number } | null) => (cell && typeof cell.value === "number" ? cell.value : 0);
	const availableFunds = v(vals[0]);
	const toBudget = v(vals[1]);
	const budgets = new Map<string, number>();
	start.ids.forEach((id, i) => budgets.set(id, v(vals[i + 2])));
	return { sheet: start.sheet, availableFunds, toBudget, budgets };
}

export function getVisibleSheets(): string[] {
	try {
		const cells = document.querySelectorAll('[data-testid^="budget2"][data-testid*="!sum-amount-"]');
		const sheets = new Set<string>();
		for (const c of Array.from(cells)) {
			const m = c.getAttribute("data-testid")?.match(/^(budget\d{6})/);
			if (m) sheets.add(m[1]);
		}
		return Array.from(sheets);
	} catch {
		return [];
	}
}

export function sheetToMonthKey(sheet: string): string | null {
	const m = sheet && sheet.match(/^budget(\d{4})(\d{2})/);
	return m ? `${m[1]}-${m[2]}` : null;
}

export function sheetToMonthLabel(sheet: string): string | null {
	const key = sheetToMonthKey(sheet);
	return formatMonthLabel(key);
}

export function formatMonthLabel(value: string | null): string | null {
	if (!value) return null;
	const key = String(value);
	const m = key.match(/^(\d{4})-(\d{2})$/);
	if (!m) return key;
	const month = Number(m[2]);
	if (month < 1 || month > 12) return key;
	const date = new Date(Number(m[1]), month - 1, 1);
	return new Intl.DateTimeFormat(undefined, {
		month: "long",
		year: "numeric",
	}).format(date);
}

export function activeMonthLabel(): string | null {
	const current = getCurrentSheet();
	return current ? sheetToMonthLabel(current) : null;
}

export function monthLabelForHeader(value: string | null): string | null {
	return formatMonthLabel(value) || activeMonthLabel();
}

export function getCurrentSheet(): string | null {
	// Prefer a sheet whose URL/focus matches, fall back to first visible.
	return getVisibleSheets()[0] || null;
}

// True when the user is on Actual's Budget page. On other pages (reports,
// schedules, accounts, …) the budget cells aren't relevant and the priority
// status should auto-collapse.
export function isBudgetPage(): boolean {
	return matchesPage(Page.Budget);
}

export function startSnapshotAllVisible(): SnapshotDescriptor[] {
	if (!categoriesCache) return [];
	const sheets = getVisibleSheets();
	return sheets.map((s) => startSnapshotMonth(s, categoriesCache!));
}

export async function finishSnapshots(starts: SnapshotDescriptor[]): Promise<Map<string, SnapshotResult>> {
	const snaps = await Promise.all(starts.map(awaitSnapshotMonth));
	const map = new Map<string, SnapshotResult>();
	snaps.forEach((s) => map.set(s.sheet, s));
	return map;
}

// ── DOM quiescence ───────────────────────────────────────────────────
export function waitForQuiescence(idleMs?: number, maxMs?: number): Promise<void> {
	const idle = idleMs ?? 250;
	const max = maxMs ?? 3000;
	return new Promise<void>((resolve) => {
		let idleTimer: ReturnType<typeof setTimeout> | null = null;
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			if (idleTimer) clearTimeout(idleTimer);
			clearTimeout(hardStop);
			obs.disconnect();
			resolve();
		};
		const arm = () => {
			if (idleTimer) clearTimeout(idleTimer);
			idleTimer = setTimeout(finish, idle);
		};
		const obs = new MutationObserver((muts) => {
			for (const m of muts) {
				if (m.type === "attributes" && m.attributeName === "data-cellname") {
					arm();
					return;
				}
				if (m.type === "characterData" || m.type === "childList") {
					arm();
					return;
				}
			}
		});
		obs.observe(document.body, {
			subtree: true,
			attributes: true,
			attributeFilter: ["data-cellname"],
			characterData: true,
			childList: true,
		});
		const hardStop = setTimeout(finish, max);
		arm();
	});
}

// ── Diff ─────────────────────────────────────────────────────────────
export function diffSnapshots(
	before: SnapshotResult,
	after: SnapshotResult,
): {
	groups: Array<{
		id: string;
		name: string;
		sort_order: number;
		rows: Array<{
			id: string;
			name: string;
			sort_order: number;
			before: number;
			after: number;
			delta: number;
		}>;
	}>;
	totalAllocated: number;
	availableBefore: number;
	availableAfter: number;
	toBudgetBefore: number;
	toBudgetAfter: number;
} {
	const cats: Category[] = categoriesCache || [];
	const groups = new Map<
		string,
		{
			id: string;
			name: string;
			sort_order: number;
			rows: Array<{
				id: string;
				name: string;
				sort_order: number;
				before: number;
				after: number;
				delta: number;
			}>;
		}
	>();
	let totalAllocated = 0;
	for (const c of cats) {
		const b = before.budgets.get(c.id) || 0;
		const a = after.budgets.get(c.id) || 0;
		const delta = a - b;
		totalAllocated += delta;
		const gid = c.group_name || "__none__";
		if (!groups.has(gid)) {
			groups.set(gid, {
				id: gid,
				name: c.group_name || "Uncategorized",
				sort_order: c.group_sort_order || 0,
				rows: [],
			});
		}
		groups.get(gid)!.rows.push({
			id: c.id,
			name: c.name,
			sort_order: c.sort_order || 0,
			before: b,
			after: a,
			delta,
		});
	}
	const groupList = Array.from(groups.values()).sort(
		(a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
	);
	for (const g of groupList) {
		g.rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
	}
	return {
		groups: groupList,
		totalAllocated,
		availableBefore: before.availableFunds,
		availableAfter: after.availableFunds,
		toBudgetBefore: before.toBudget,
		toBudgetAfter: after.toBudget,
	};
}

function parseGoalDef(goalDef: string | null | undefined): GoalDefEntry[] {
	if (!goalDef) return [];
	try {
		const parsed = JSON.parse(goalDef);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((d): d is GoalDefEntry => d && (d.directive === "template" || d.directive === "goal"));
	} catch {
		return [];
	}
}

export async function loadTemplatesByCategoryId(): Promise<Map<string, TemplateEntry[]>> {
	const byCat = new Map<string, TemplateEntry[]>();
	try {
		const cats = await query<{ id: string; tombstone: boolean; goal_def: string | null }[]>("categories");
		for (const c of cats) {
			if (c.tombstone || !c.goal_def) continue;
			const budgetTpls = templateEntriesFromGoalDef(parseGoalDef(c.goal_def));
			if (budgetTpls.length) byCat.set(c.id, budgetTpls);
		}
	} catch (e) {
		console.warn("[ABT TAB] categories query failed", e);
	}
	return byCat;
}
