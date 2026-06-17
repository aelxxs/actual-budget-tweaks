import { parseNoteTemplates } from "./templates";

// ---- TypeScript types and window augmentation ----
declare global {
	interface Window {
		$send: (msg: string, payload?: any) => Promise<any>;
		$query: (q: any) => Promise<any>;
		$q: (table: string) => any;
	}
}

export interface Category {
	id: string;
	name: string;
	sort_order: number;
	hidden: boolean;
	tombstone: boolean;
	is_income: boolean;
	group_id: string;
	group_name: string;
	group_sort_order: number;
}

export interface CategoryGroup {
	id: string;
	name: string;
	is_income: boolean;
	sort_order: number;
}

export interface SnapshotDescriptor {
	sheet: string;
	ids: string[];
	promises: Promise<any>[];
}

export interface SnapshotResult {
	sheet: string;
	availableFunds: number;
	toBudget: number;
	budgets: Map<string, number>;
}

// ── Categories cache ─────────────────────────────────────────────────
// { id, name, group_id, group_name, sort_order, group_sort_order, hidden, is_income }
// ---- Categories cache ----
let categoriesCache: Category[] | null = null;
let categoriesPromise: Promise<Category[]> | null = null;

// ── Backend readiness ────────────────────────────────────────────────
export function isBackendReady(): boolean {
	if (typeof window.$send !== "function") return false;
	if (typeof window.$query !== "function" || typeof window.$q !== "function") return false;
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

export async function loadCategories(force: boolean): Promise<Category[]> {
	if (!force && categoriesCache) return categoriesCache;
	if (!force && categoriesPromise) return categoriesPromise;
	categoriesPromise = (async () => {
		try {
			const [catsRes, groupsRes] = await Promise.all([
				window.$query(window.$q("categories").select("*")),
				window.$query(window.$q("category_groups").select("*")),
			]);
			const cats: any[] = (catsRes && catsRes.data) || [];
			const groups: any[] = (groupsRes && groupsRes.data) || [];
			const groupMap = new Map<string, any>();
			for (const g of groups) groupMap.set(g.id, g);
			categoriesCache = cats
				.map((c: any) => {
					const gid = c.cat_group || c.group;
					const g = groupMap.get(gid) || {};
					return {
						id: c.id,
						name: c.name,
						sort_order: c.sort_order || 0,
						hidden: !!c.hidden,
						tombstone: !!c.tombstone,
						is_income: !!g.is_income,
						group_id: gid || "__none__",
						group_name: g.name || "Uncategorized",
						group_sort_order: g.sort_order || 0,
					} as Category;
				})
				.filter((c: Category) => !c.tombstone);
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
		names.map((n: string) => window.$send("get-cell", { sheetName: sheet, name: n }).catch(() => null)),
	);
	const map = new Map<string, number>();
	names.forEach((n: string, i: number) => {
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
	const ids = cats.filter((c: Category) => !c.hidden).map((c: Category) => c.id);
	const promises: Promise<any>[] = [
		window.$send("get-cell", { sheetName: sheet, name: "available-funds" }),
		window.$send("get-cell", { sheetName: sheet, name: "to-budget" }),
		...ids.map((id: string) => window.$send("get-cell", { sheetName: sheet, name: "budget-" + id })),
	];
	return { sheet, ids, promises };
}

export async function awaitSnapshotMonth(start: SnapshotDescriptor): Promise<SnapshotResult> {
	const vals = await Promise.all(start.promises.map((p: Promise<any>) => p.catch(() => null)));
	const v = (cell: any) => (cell && typeof cell.value === "number" ? cell.value : 0);
	const availableFunds = v(vals[0]);
	const toBudget = v(vals[1]);
	const budgets = new Map<string, number>();
	start.ids.forEach((id: string, i: number) => budgets.set(id, v(vals[i + 2])));
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
	return location.pathname === "/budget";
}

export function startSnapshotAllVisible(): SnapshotDescriptor[] {
	if (!categoriesCache) return [];
	const sheets = getVisibleSheets();
	return sheets.map((s: string) => startSnapshotMonth(s, categoriesCache!));
}

export async function finishSnapshots(starts: SnapshotDescriptor[]): Promise<Map<string, SnapshotResult>> {
	const snaps = await Promise.all(starts.map(awaitSnapshotMonth));
	const map = new Map<string, SnapshotResult>();
	snaps.forEach((s: SnapshotResult) => map.set(s.sheet, s));
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
		const gid = c.group_id || "__none__";
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
		g.rows.sort((a: any, b: any) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
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

export async function loadTemplatesByCategoryId(): Promise<Map<string, any[]>> {
	const byCat = new Map<string, any[]>();
	try {
		const res = await window.$query(window.$q("notes").select("*"));
		const notes = (res && res.data) || [];
		const catIds = new Set((categoriesCache || []).map((c: Category) => c.id));
		for (const n of notes) {
			if (!n.note) continue;
			if (catIds.size && !catIds.has(n.id)) continue;
			const tpls = parseNoteTemplates(n.note);
			const budgetTpls = tpls.filter((t: any) => t.kind !== "goal");
			if (budgetTpls.length) byCat.set(n.id, budgetTpls);
		}
	} catch (e) {
		console.warn("[ABT TAB] notes query failed", e);
	}
	return byCat;
}
