import { loadMonthMoves } from "@lib/utilities/budget-moves";
import { isPanelPersistedOpen, sidepanel, wasPanelPersistedOpen } from "@features/core/side-panel";
import { defineSetting } from "@features/types";
import { icon } from "@lib/utilities/icons";
import type { Schedule } from "@lib/types/actual-schema";
import { loadCurrentBudgetId, notify, onListChange, query, send } from "@lib/utilities/actual-api";
import {
	type BudgetTableChange,
	collectChanges,
	readCells,
	watchBudgetTable,
} from "@lib/utilities/budget-cells";
import { loadCurrency } from "@lib/utilities/currency";
import { isTrackingBudget, onBudgetType } from "@lib/utilities/budget-type";
import { watchDom } from "@lib/utilities/dom-watcher";
import { addMonths, monthToSheet, sheetToMonth } from "@lib/utilities/months";
import { Page, matchesPage } from "@lib/utilities/pages";
import { getValue, removeValue, setValue } from "@lib/utilities/store";
import { followBudgetValue } from "@lib/utilities/budget-value";
import { CARDS_KEY, toLayout } from "./cards";
import { type Mounted, mountToPanelBody } from "@lib/utilities/svelte";
import {
	diffSnapshots,
	finishSnapshots,
	getCurrentSheet,
	invalidateCategoriesCache,
	isBudgetPage,
	loadCategories,
	loadTemplatesByCategoryId,
	sheetToMonthLabel,
	startSnapshotAllVisible,
	waitForQuiescence,
	type SnapshotDescriptor,
} from "@lib/template-plan/actual-data";
import {
	previewMonthTemplates,
	previewMonthTemplateTotal,
} from "@lib/template-plan/next-month-coverage";
import { type Category, createPriorityPlanner } from "@lib/template-plan/priority-plan";
import type { TemplateEntry } from "@lib/template-plan/templates";
import {
	BREAKDOWN_STORAGE_KEY,
	PRIO_COLLAPSE_STORAGE_KEY,
	TAB_STORAGE_KEY,
	TRIGGER_LABELS,
} from "./constants";
import { CSS } from "./css";
import {
	buildTrend,
	heldForNextMonth,
	monthCellNames,
	nextMonthGoalNeed,
	recentAverageSpending,
	summarizeCategories,
	summarizeIncome,
	trendCellNames,
	trendMonths,
	upcomingSchedules,
} from "./overview";
import {
	INSIGHTS_TABS,
	templatePlanState,
	type BreakdownDiff,
	type InsightsTab,
	type BreakdownState,
	type OverviewData,
	type TrackedAction,
} from "./state.svelte";
import TemplatePlanPanel from "./TemplatePlanPanel.svelte";
import { createLogger } from "@lib/utilities/logger";
import { BUDGET_LINK, BUDGET_TABLE } from "@lib/actual-dom";

const log = createLogger("template-plan");

const TRIGGER_ID = "abt-template-plan-trigger";
const PANEL_KEY = "insights";
// Aborted when the feature turns off, so async work started before then drops its result.
let session: AbortSignal | null = null;

const priorityPlanner = createPriorityPlanner({
	getCells: readCells,
	sheetToMonthKey: sheetToMonth,
	getCurrentSheet,
	isBudgetPage,
	loadCategories,
	loadTemplatesByCategoryId,
	sheetToMonthLabel,
});
const { computePriorityStatus, buildBreakdownPrioritySummary, invalidatePriorityStatus } =
	priorityPlanner;

// ── Panel mount (built once, reused across opens) ────────────────────
let panel: Mounted | null = null;
// The panel stays mounted while hidden: its title waits for the next open, not another panel's header.
let panelTitle: string | undefined;

function updateTitle(title: string): void {
	panelTitle = title;
	if (drawerOpen) {
		sidepanel.setTitle(title);
	}
}

function ensurePanelMounted(): HTMLElement {
	panel ??= mountToPanelBody(TemplatePlanPanel, { onTitle: updateTitle });
	return panel.node;
}

function teardownPanel(): void {
	panel?.destroy();
	panel = null;
}

// ── Trigger button ────────────────────────────────────────────────────
let triggerBtn: HTMLButtonElement | null = null;
let triggerDocked = false;

function ensureTriggerButton(): void {
	if (!session) {
		return;
	}
	templatePlanState.triggerShown = true;
	if (!triggerDocked) {
		mountFloatingTrigger();
	}
}

function mountFloatingTrigger(): void {
	if (document.getElementById(TRIGGER_ID)) {
		return;
	}
	const btn = document.createElement("button");
	btn.id = TRIGGER_ID;
	btn.className = "abt-template-drawer-trigger";
	btn.type = "button";
	btn.title = "Open insights";
	btn.setAttribute("aria-label", "Open insights");
	btn.innerHTML = icon("chevronLeft", { size: 14 });
	btn.appendChild(document.createTextNode("Insights"));
	btn.addEventListener("click", () => openPanel());
	document.body.appendChild(btn);
	triggerBtn = btn;
}

function removeTriggerButton(): void {
	templatePlanState.triggerShown = false;
	triggerBtn?.remove();
	triggerBtn = null;
}

/** Lets a page header draw the Insights trigger in place of the floating button. */
export function dockInsightsTrigger(): () => void {
	triggerDocked = true;
	triggerBtn?.remove();
	triggerBtn = null;
	return () => {
		triggerDocked = false;
		if (templatePlanState.triggerShown) {
			mountFloatingTrigger();
		}
	};
}

export function openInsights(tab?: InsightsTab): void {
	if (tab === "priority" && templatePlanState.trackingBudget) {
		tab = "overview";
	}
	if (tab && templatePlanState.activeTab !== tab) {
		templatePlanState.activeTab = tab;
		setValue(TAB_STORAGE_KEY, tab);
		if (drawerOpen) {
			templatePlanState.onTabChange?.(tab);
		}
	}
	if (isBudgetPage()) {
		openPanel();
	} else {
		openOnArrival = true;
	}
}

// ── Drawer open/close ─────────────────────────────────────────────────
let drawerOpen = false;
let drawerMounted = false;
// Asked for from another page: the panel needs the budget table, so it waits for that.
let openOnArrival = false;

function openPanel(): void {
	if (!session || !isBudgetPage()) {
		return;
	}
	drawerOpen = true;
	drawerMounted = false;
	removeTriggerButton();
	const bodyNode = ensurePanelMounted();
	sidepanel.open({
		title: panelTitle,
		bodyNode,
		key: PANEL_KEY,
		persist: true,
	});
	if (templatePlanState.activeTab === "overview" && !templatePlanState.overviewLoading) {
		// Kept numbers may be stale: schedules or transactions changed on another page.
		refreshOverview({ quiet: !!templatePlanState.overviewData });
	} else if (
		templatePlanState.activeTab === "priority" &&
		!templatePlanState.priorityLoading &&
		!templatePlanState.priorityData
	) {
		refreshPriorityIfNeeded();
	}
}

// Reopens the panel if it was left open here, else shows the trigger (see wasPanelPersistedOpen).
function reopenIfPersisted(): void {
	const signal = session;
	wasPanelPersistedOpen().then((persisted) => {
		if (!signal || signal.aborted || !isBudgetPage()) {
			return;
		}
		if (persisted) {
			if (!drawerOpen) {
				openPanel();
			}
		} else if (!drawerOpen) {
			ensureTriggerButton();
		}
	});
}

function closePanel(): void {
	drawerOpen = false;
	sidepanel.close(PANEL_KEY);
	if (isBudgetPage()) {
		ensureTriggerButton();
	}
}

// ── Persisted UI state ────────────────────────────────────────────────
async function loadPersistedState(): Promise<void> {
	const tab = await getValue<InsightsTab>(TAB_STORAGE_KEY, "overview");
	if (INSIGHTS_TABS.includes(tab)) {
		templatePlanState.activeTab = tab;
	}

	const collapse = await getValue<Record<string, boolean>>(PRIO_COLLAPSE_STORAGE_KEY, {});
	for (const [k, v] of Object.entries(collapse)) {
		if (typeof v === "boolean") {
			templatePlanState.prioCollapseOverrides[k] = v;
		}
	}
}

let budgetLoaded = false;

/** Each budget keeps its own last breakdown; another budget's categories and amounts aren't this one's. */
const breakdownKey = (budgetId: string) => `${BREAKDOWN_STORAGE_KEY}:${budgetId}`;

async function loadBudgetBreakdown(): Promise<void> {
	// Saved before breakdowns were kept per budget, so there's no telling whose it is.
	void removeValue(BREAKDOWN_STORAGE_KEY);
	const budgetId = await loadCurrentBudgetId().catch(() => undefined);
	const saved = budgetId
		? await getValue<BreakdownState | null>(breakdownKey(budgetId), null)
		: null;
	// Templates applied while this loaded keep their newer breakdown.
	if (templatePlanState.breakdownState?.budgetId !== budgetId) {
		templatePlanState.breakdownState = saved;
	}
}

function saveBreakdown(): void {
	const state = templatePlanState.breakdownState;
	if (state?.budgetId) {
		setValue(breakdownKey(state.budgetId), state);
	}
}

// ── Overview refresh ──────────────────────────────────────────────────
/** The latest refresh of each tab; an older one finishing late (another month) is dropped. */
let overviewSeq = 0;
let prioritySeq = 0;

/** `quiet` keeps the current numbers undimmed, for live updates while the user edits. */
// Next month and eleven after it; each month is a template dry run per category, and Actual's
// worker runs them one at a time, so previewing months in parallel doesn't save anything.
const AHEAD_MONTHS = 11;

/**
 * Template needs for the months after next (assigned plus what templates still need), as far as
 * the money held for next month could reach. Stops at the first month that can't be previewed.
 */
async function aheadTemplateNeeds(
	d: OverviewData,
	cats: Category[],
	templates: Map<string, TemplateEntry[]>,
	/** True once another refresh has started; the worker runs dry runs in turn, so stop early. */
	stale: () => boolean,
): Promise<number[]> {
	const need = nextMonthGoalNeed(d);
	let spare = heldForNextMonth(d) - (need ?? 0);
	if (!d.hasTemplates || need === null || need <= 0) {
		return [];
	}
	const needs: number[] = [];
	let month = d.nextMonthKey;
	while (spare > 0 && needs.length < AHEAD_MONTHS && !stale()) {
		month = addMonths(month, 1);
		const [remaining, cells] = await Promise.all([
			previewMonthTemplateTotal(month, cats, templates),
			readCells(monthToSheet(month), ["total-budgeted"]),
		]);
		const n = remaining === null ? 0 : Math.abs(cells.get("total-budgeted") ?? 0) + remaining;
		if (n <= 0) {
			break;
		}
		needs.push(n);
		spare -= n;
	}
	return needs;
}

/**
 * Walks already done, by the budget, month and the figures they started from, so going back to a
 * month shows its months ahead at once. An edit clears them: it can change a later month's need
 * alone. They're kept in this browser too; those are walked again once, in the background, since
 * another device may have changed a later month meanwhile.
 */
const aheadCache = new Map<string, number[]>();
const unverified = new Set<string>();
const AHEAD_STORE = "abt-insights-ahead";
const AHEAD_STORED = 60;
let cacheBudget: string | undefined;

/** Overviews of the months either side of the one shown, worked out ahead so stepping draws at once. */
const overviewCache = new Map<string, OverviewData>();
const OVERVIEWS_KEPT = 12;

function readStoredAhead(): Record<string, number[]> {
	try {
		const raw = JSON.parse(localStorage.getItem(AHEAD_STORE) ?? "{}");
		return raw && typeof raw === "object" ? raw : {};
	} catch {
		return {};
	}
}

function writeStoredAhead(stored: Record<string, number[]>): void {
	try {
		localStorage.setItem(AHEAD_STORE, JSON.stringify(stored));
	} catch {
		// Only this browser's head start is lost.
	}
}

function rememberAhead(key: string, needs: number[]): void {
	aheadCache.set(key, needs);
	unverified.delete(key);
	const stored = readStoredAhead();
	delete stored[key];
	stored[key] = needs;
	const keys = Object.keys(stored);
	for (const old of keys.slice(0, Math.max(0, keys.length - AHEAD_STORED))) {
		delete stored[old];
	}
	writeStoredAhead(stored);
}

function forgetAhead(): void {
	aheadCache.clear();
	unverified.clear();
	overviewCache.clear();
	const stored = readStoredAhead();
	for (const key of Object.keys(stored)) {
		if (key.startsWith(`${cacheBudget}|`)) {
			delete stored[key];
		}
	}
	writeStoredAhead(stored);
}

/** Switches the caches to the open budget, taking up what this browser kept for it; true if it changed. */
async function useBudgetCache(): Promise<boolean> {
	const id = await loadCurrentBudgetId().catch(() => undefined);
	if (id === cacheBudget) {
		return false;
	}
	cacheBudget = id;
	aheadCache.clear();
	unverified.clear();
	overviewCache.clear();
	for (const [key, needs] of Object.entries(readStoredAhead())) {
		if (key.startsWith(`${id}|`) && Array.isArray(needs)) {
			aheadCache.set(key, needs);
			unverified.add(key);
		}
	}
	return true;
}

/** Where a month's walk is kept, or null when there's nothing to walk. */
function aheadKey(d: OverviewData): string | null {
	const need = nextMonthGoalNeed(d);
	if (!d.hasTemplates || need === null || heldForNextMonth(d) <= need) {
		return null;
	}
	return [cacheBudget, d.monthKey, heldForNextMonth(d), need].join("|");
}

/** The months-ahead walk for `d`, from the cache or walked now; null if a newer refresh took over. */
async function resolveAhead(
	d: OverviewData,
	cats: Category[],
	templates: Map<string, TemplateEntry[]>,
	stale: () => boolean,
): Promise<number[] | null> {
	if (d.budgetType === "tracking") {
		return [];
	}
	const key = aheadKey(d);
	if (key === null) {
		return [];
	}
	const cached = aheadCache.get(key);
	if (cached && !unverified.has(key)) {
		return cached;
	}
	const ahead = await aheadTemplateNeeds(d, cats, templates, stale);
	if (stale()) {
		return null;
	}
	rememberAhead(key, ahead);
	return ahead;
}

function keepOverview(d: OverviewData): void {
	overviewCache.delete(d.sheet);
	overviewCache.set(d.sheet, d);
	if (overviewCache.size > OVERVIEWS_KEPT) {
		overviewCache.delete(overviewCache.keys().next().value!);
	}
}

/** One month's overview, without its months ahead (`aheadTemplateNeeds` is null). */
async function loadOverview(sheet: string): Promise<{
	data: OverviewData;
	cats: Category[];
	templates: Map<string, TemplateEntry[]>;
}> {
	const tracking = isTrackingBudget();
	const cats = (await loadCategories()).filter((c) => !c.hidden);
	const monthKey = sheetToMonth(sheet) ?? "";
	const months = trendMonths(monthKey);
	const nextMonthKey = addMonths(monthKey, 1);

	const [
		cells,
		schedules,
		pastCells,
		nextCells,
		nextMonthGoalTotal,
		templatePreview,
		templates,
		moves,
	] = await Promise.all([
		readCells(sheet, monthCellNames(cats, tracking)),
		query<Schedule[]>("schedules", { filter: { tombstone: false, completed: false } }),
		Promise.all(
			months.slice(0, -1).map((k) => readCells(monthToSheet(k), trendCellNames(cats, tracking))),
		),
		tracking
			? Promise.resolve(new Map<string, number>())
			: readCells(monthToSheet(nextMonthKey), ["total-budgeted"]),
		tracking ? Promise.resolve(null) : previewMonthTemplateTotal(nextMonthKey, cats),
		// Goal cells can't tell what's left: they fill once templates run, and Actual can set them
		// without budgeting anything (actualbudget/actual#9304).
		previewMonthTemplates(monthKey, cats),
		loadTemplatesByCategoryId(),
		loadMonthMoves(monthKey).catch(() => []),
	]);

	const toBudget = cells.get("to-budget") ?? 0;
	const totalBudgeted = Math.abs(cells.get("total-budgeted") ?? 0);
	const trend = buildTrend(months, [...pastCells, cells], cats, tracking);
	const categorySummary = summarizeCategories(cats, cells);

	const data: OverviewData = {
		sheet,
		monthKey,
		budgetType: tracking ? "tracking" : "envelope",
		availableFunds: cells.get("available-funds") ?? toBudget + totalBudgeted,
		toBudget,
		totalBudgeted,
		lastMonthOverspent: cells.get("last-month-overspent") ?? 0,
		bufferedSelected: cells.get("buffered-selected") ?? 0,
		incomeBudgeted: cells.get("total-budget-income") ?? 0,
		spentBudgeted: totalBudgeted,
		saved: cells.get("real-saved") ?? 0,
		projected: cells.get("total-saved") ?? 0,
		...categorySummary,
		totalSpent: tracking ? Math.abs(cells.get("total-spent") ?? 0) : categorySummary.totalSpent,
		upcomingSchedules: upcomingSchedules(schedules ?? []),
		trend,
		nextMonthKey,
		nextMonthBudgeted: Math.abs(nextCells.get("total-budgeted") ?? 0),
		nextMonthGoalTotal,
		recentAvgSpending: recentAverageSpending(trend, totalBudgeted),
		templateRemaining: templatePreview?.remaining ?? null,
		templateToApply: templatePreview?.onApply ?? null,
		hasTemplates: cats.some((c) => templates.has(c.id)),
		income: summarizeIncome(cats, cells, trend),
		moves,
		aheadTemplateNeeds: null,
	};
	return { data, cats, templates };
}

/**
 * Works out the months either side once the shown one is done, while nothing else is asked of
 * Actual's worker; a new refresh stops it between dry runs.
 */
async function prefetchAround(monthKey: string, seq: number): Promise<void> {
	if (isTrackingBudget()) {
		return;
	}
	for (const step of [1, -1]) {
		const sheet = monthToSheet(addMonths(monthKey, step));
		if (seq !== overviewSeq) {
			return;
		}
		if (overviewCache.has(sheet)) {
			continue;
		}
		try {
			const { data, cats, templates } = await loadOverview(sheet);
			const ahead = await resolveAhead(data, cats, templates, () => seq !== overviewSeq);
			if (ahead === null) {
				return;
			}
			keepOverview({ ...data, aheadTemplateNeeds: ahead });
		} catch (e) {
			log.debug("prefetch failed", e);
		}
	}
}

async function refreshOverview({ quiet = false }: { quiet?: boolean } = {}): Promise<void> {
	if (!isBudgetPage()) {
		return;
	}
	const seq = ++overviewSeq;
	const stale = () => seq !== overviewSeq;
	const previous = templatePlanState.overviewData;
	const sheet = getCurrentSheet();
	if (!sheet) {
		templatePlanState.overviewData = null;
		return;
	}
	// A month worked out ahead shows at once, before anything is awaited, and is checked below.
	let kept = quiet ? null : (overviewCache.get(sheet) ?? null);
	if (kept) {
		templatePlanState.overviewData = kept;
	} else if (!quiet) {
		templatePlanState.overviewLoading = true;
	}
	if (await useBudgetCache()) {
		kept = null;
	}
	// Quiet refreshes follow edits.
	if (quiet) {
		forgetAhead();
	}
	if (stale()) {
		return;
	}
	try {
		const { data, cats, templates } = await loadOverview(sheet);
		if (stale()) {
			return;
		}
		if (data.budgetType === "tracking") {
			const done = { ...data, aheadTemplateNeeds: [] };
			templatePlanState.overviewData = done;
			templatePlanState.overviewLoading = false;
			keepOverview(done);
			return;
		}
		const key = aheadKey(data);
		const cached = key === null ? [] : aheadCache.get(key);
		// An edit keeps the last walk on screen until the new one is in; another month waits.
		const showing =
			previous?.sheet === sheet || kept ? (kept ?? previous)!.aheadTemplateNeeds : null;
		templatePlanState.overviewData = { ...data, aheadTemplateNeeds: cached ?? showing };
		templatePlanState.overviewLoading = false;
		const ahead = await resolveAhead(data, cats, templates, stale);
		if (ahead === null) {
			return;
		}
		const done = { ...data, aheadTemplateNeeds: ahead };
		templatePlanState.overviewData = done;
		keepOverview(done);
		void prefetchAround(data.monthKey, seq);
	} catch (e) {
		log.warn("overview refresh failed", e);
	} finally {
		if (seq === overviewSeq) {
			templatePlanState.overviewLoading = false;
		}
	}
}

// ── Priority refresh ──────────────────────────────────────────────────
async function refreshPriorityIfNeeded(): Promise<void> {
	if (!isBudgetPage()) {
		return;
	}
	const seq = ++prioritySeq;
	templatePlanState.priorityLoading = true;
	try {
		// The result, not getPriorityCache(): early exits never fill the cache, which left a spinner.
		const data = await computePriorityStatus(false);
		if (seq === prioritySeq) {
			templatePlanState.priorityData = data;
		}
	} catch (e) {
		log.warn("template plan priority compute failed", e);
		if (seq !== prioritySeq) {
			return;
		}
		templatePlanState.priorityData = {
			ok: false,
			reason: "failed to compute",
			computedAt: Date.now(),
		};
	} finally {
		if (seq === prioritySeq) {
			templatePlanState.priorityLoading = false;
		}
	}
}

// ── Click interception (apply/overwrite) ─────────────────────────────
let runSeq = 0;
const EMPTY_DIFF: BreakdownDiff = {
	groups: [],
	totalAllocated: 0,
	availableBefore: 0,
	availableAfter: 0,
	toBudgetBefore: 0,
	toBudgetAfter: 0,
};

function classifyTrigger(target: EventTarget | null) {
	if (!target) {
		return null;
	}
	const btn = (target as HTMLElement).closest?.("button");
	if (!btn) {
		return null;
	}
	const text = (btn.textContent || "").trim().toLowerCase();
	if (!text) {
		return null;
	}
	return TRIGGER_LABELS.get(text) ?? null;
}

/**
 * Shows what a budget action changed in Breakdown. `doWork` runs the action, when ABT does
 * rather than Actual's own menu; its result and errors go back to the caller.
 */
async function handleTrigger<T>(
	kind: BreakdownState["ctx"]["kind"],
	beforeStarts: SnapshotDescriptor[],
	doWork?: () => Promise<T>,
): Promise<T | undefined> {
	const seq = ++runSeq;
	const signal = session;
	// A newer run replaced this one, or the feature turned off.
	const stale = () => seq !== runSeq || !signal || signal.aborted;
	templatePlanState.breakdownLoading = true;
	if (templatePlanState.activeTab !== "breakdown") {
		templatePlanState.activeTab = "breakdown";
		setValue(TAB_STORAGE_KEY, "breakdown");
	}
	if (!drawerOpen) {
		openPanel();
	}

	let result: T | undefined;
	let failure: { error: unknown } | null = null;
	try {
		// A snapshot that fails costs the breakdown, never the action.
		const beforeMap = await finishSnapshots(beforeStarts).catch((e) => {
			log.warn("template plan snapshot failed", e);
			return null;
		});
		if (doWork) {
			try {
				result = await doWork();
			} catch (error) {
				failure = { error };
			}
		}
		if (beforeMap && !failure) {
			await recordBreakdown(kind, beforeMap, stale);
		}
	} catch (e) {
		log.warn("template plan breakdown failed", e);
	} finally {
		if (seq === runSeq) {
			templatePlanState.breakdownLoading = false;
		}
	}
	if (failure) {
		throw failure.error;
	}
	return result;
}

/** ABT's own actions, run from its buttons, which the click listener can't classify. */
async function trackBreakdown<T>(kind: TrackedAction, work: () => Promise<T>): Promise<T> {
	if (!isBudgetPage()) {
		return work();
	}
	// With `doWork`, a run that doesn't throw returns its result.
	return (await handleTrigger(kind, startSnapshotAllVisible(), work)) as T;
}

async function recordBreakdown(
	kind: BreakdownState["ctx"]["kind"],
	beforeMap: Awaited<ReturnType<typeof finishSnapshots>>,
	stale: () => boolean,
): Promise<void> {
	// Lets Actual's spreadsheet and React settle the new values, from a click or a send().
	await waitForQuiescence().catch(() => {});
	if (stale()) {
		return;
	}
	const afterMap = await finishSnapshots(startSnapshotAllVisible());
	if (stale()) {
		return;
	}

	// The month that changed most is the one the templates were applied to.
	let diff: BreakdownDiff | null = null;
	let sheet: string | null = null;
	let bestScore = 0;
	for (const [key, after] of afterMap) {
		const before = beforeMap.get(key);
		if (!before) {
			continue;
		}
		const d = diffSnapshots(before, after);
		const score = d.groups.reduce(
			(acc, g) => acc + g.rows.reduce((a, r) => a + Math.abs(r.delta), 0),
			0,
		);
		if (score > bestScore) {
			[bestScore, diff, sheet] = [score, d, key];
		}
	}
	sheet ??= afterMap.keys().next().value ?? null;

	// Covering overspending moves money by need, not by template priority.
	const priorityBreakdown =
		sheet && diff && kind !== "cover"
			? await buildBreakdownPrioritySummary(sheet, diff).catch((e) => {
					log.warn("template plan priority breakdown failed", e);
					return null;
				})
			: null;
	const budgetId = await loadCurrentBudgetId().catch(() => undefined);
	if (stale()) {
		return;
	}

	templatePlanState.breakdownState = {
		diff: diff ?? EMPTY_DIFF,
		budgetId,
		ctx: { kind, month: sheetToMonthLabel(sheet ?? ""), notification: null, priorityBreakdown },
	};
	saveBreakdown();
	templatePlanState.overviewData = null;
	invalidatePriorityStatus();
	refreshPriorityIfNeeded();
}

function installClickListener(): () => void {
	const handler = (ev: MouseEvent) => {
		if (!matchesPage(Page.Budget)) {
			return;
		}
		const kind = classifyTrigger(ev.target);
		if (!kind) {
			return;
		}
		const beforeStarts = startSnapshotAllVisible();
		handleTrigger(kind, beforeStarts);
	};
	document.addEventListener("click", handler, true);
	return () => document.removeEventListener("click", handler, true);
}

function installKeyboard(): () => void {
	const handler = (ev: KeyboardEvent) => {
		if (ev.key !== "Escape") {
			return;
		}
		if (!drawerOpen || !isBudgetPage()) {
			return;
		}
		closePanel();
	};
	document.addEventListener("keydown", handler);
	return () => document.removeEventListener("keydown", handler);
}

// ── Month changes ─────────────────────────────────────────────────────
const MONTH_REFRESH_MS = 250;
let lastSheetKey: string | null = null;
let monthRefresh: ReturnType<typeof setTimeout> | undefined;

/** Refreshes the open tab once the shown month settles, so clicking through months fetches once. */
function checkSheetChange(): void {
	if (!matchesPage(Page.Budget)) {
		return;
	}
	const sheet = getCurrentSheet();
	const key = sheet ? sheetToMonth(sheet) : null;
	if (key === lastSheetKey) {
		return;
	}
	lastSheetKey = key;
	invalidatePriorityStatus();
	// The last month's numbers stay up, dimmed, until the new ones replace them; the
	// skeleton is only for a tab with nothing to show yet.
	if (drawerOpen && templatePlanState.activeTab === "overview") {
		templatePlanState.overviewLoading = true;
	} else if (drawerOpen && templatePlanState.activeTab === "priority") {
		templatePlanState.priorityLoading = true;
	}
	clearTimeout(monthRefresh);
	monthRefresh = setTimeout(refreshOpenTab, MONTH_REFRESH_MS);
}

function refreshOpenTab(): void {
	if (!drawerOpen || !isBudgetPage()) {
		prioritySeq++;
		templatePlanState.priorityLoading = false;
		// The summary row's Months ahead card asks for the new month itself.
		if (!templatePlanState.overviewWanted) {
			overviewSeq++;
			templatePlanState.overviewLoading = false;
		}
		return;
	}
	if (templatePlanState.activeTab === "priority") {
		refreshPriorityIfNeeded();
	} else if (templatePlanState.activeTab === "overview") {
		refreshOverview();
	}
}

// ── Live edits ────────────────────────────────────────────────────────
// Long enough to fold one edit's burst of cell updates into a single re-read.
const LIVE_REFRESH_MS = 50;
let stopTable: (() => void) | null = null;
let liveEdits: ReturnType<typeof collectChanges> | null = null;

/**
 * Follows the month shown, and re-reads the Overview when its cells change (assigning, a
 * synced transaction), so it stays current without a refresh.
 */
function onTableChange({ changed, moved }: BudgetTableChange): void {
	// Every batch, not only `moved` ones: the cells' sheet names can settle a render after the header.
	checkSheetChange();
	// Navigating fills in the new month's cells, which isn't an edit; checkSheetChange refreshes it.
	if (moved || !drawerOpen || templatePlanState.activeTab !== "overview") {
		return;
	}
	const sheet = getCurrentSheet();
	if (sheet && changed.has(sheet)) {
		liveEdits?.add(changed);
	}
}

function watchCells(): void {
	liveEdits ??= collectChanges(LIVE_REFRESH_MS, () => refreshOverview({ quiet: true }));
	stopTable ??= watchBudgetTable(onTableChange);
}

function stopWatchingCells(): void {
	stopTable?.();
	stopTable = null;
	liveEdits?.stop();
	liveEdits = null;
}

// ── Page gating ────────────────────────────────────────────────────────
let wasOnBudgetPage = false;

function tick(): void {
	// Actual's own link to the budget exists only while a budget is open, so this catches every switch.
	const loaded = !!document.querySelector(BUDGET_LINK);
	if (loaded && !budgetLoaded) {
		void loadBudgetBreakdown();
	}
	budgetLoaded = loaded;

	if (!matchesPage(Page.Budget)) {
		stopWatchingCells();
		if (wasOnBudgetPage) {
			wasOnBudgetPage = false;
			drawerOpen = false;
			removeTriggerButton();
			// Hidden, not closed: it reopens when the budget page comes back.
			sidepanel.dismiss();
		}
		return;
	}

	watchCells();

	// The path changes a frame before Actual swaps in the budget page; opening the panel then
	// squeezed the page being left, so arriving waits for the budget table.
	if (!wasOnBudgetPage && document.querySelector(BUDGET_TABLE)) {
		wasOnBudgetPage = true;
		invalidateCategoriesCache();
		// Left open last time: refilled synchronously once known, so it's back before the page paints.
		const persisted = isPanelPersistedOpen();
		if (openOnArrival) {
			openOnArrival = false;
			openPanel();
		} else if (persisted === undefined) {
			reopenIfPersisted();
		} else if (!drawerOpen) {
			if (persisted) {
				openPanel();
			} else {
				ensureTriggerButton();
			}
		}
	}

	// The side panel's own close button has no hook, so its closing is noticed here.
	if (drawerOpen) {
		if (sidepanel.isOpen(PANEL_KEY)) {
			drawerMounted = true;
		} else if (drawerMounted) {
			drawerOpen = false;
			ensureTriggerButton();
		}
	}
}

export const templatePlan = defineSetting({
	type: "checkbox",
	label: "Budget insights",
	description: "Shows the month's summary, templates and plan in a side panel.",
	icon: "panelRight",
	group: "Budget",
	writes: "Applies the month's budget templates when you click Apply.",
	guide: "/guides/budget-insights",
	context: {
		key: "actual-template-apply-breakdown",
		defaultValue: true,
	},
	css: () => CSS,
	init: async () => {
		const controller = new AbortController();
		session = controller.signal;
		templatePlanState.enabled = true;
		templatePlanState.trackingBudget = isTrackingBudget();
		loadCurrency();
		await loadPersistedState();
		templatePlanState.trackingBudget = isTrackingBudget();
		if (templatePlanState.trackingBudget && templatePlanState.activeTab === "priority") {
			templatePlanState.activeTab = "overview";
		}
		// Per budget, and followed through settings sync: a budget with none starts from the default.
		const cards = followBudgetValue(CARDS_KEY, (v) => (templatePlanState.cards = toLayout(v)));
		templatePlanState.saveCards = (layout) => void cards.save(layout);
		// From when the layout was one setting for every budget.
		void removeValue(CARDS_KEY);
		// Not awaited: it waits for the budget page, and every feature's init blocks the settings panel.
		loadCategories();

		templatePlanState.onTabChange = (tab) => {
			if (tab === "overview") {
				refreshOverview();
			} else if (tab === "priority") {
				refreshPriorityIfNeeded();
			}
		};

		templatePlanState.applyTemplates = async () => {
			if (!isBudgetPage()) {
				return;
			}
			const sheet = getCurrentSheet();
			const month = sheet ? sheetToMonth(sheet) : null;
			if (!month) {
				return;
			}
			const beforeStarts = startSnapshotAllVisible();
			try {
				await handleTrigger("apply", beforeStarts, () =>
					send("budget/apply-goal-template", { month }),
				);
			} catch (e) {
				void notify({ type: "error", message: "Couldn't apply templates", pre: String(e) });
			}
		};

		templatePlanState.trackBreakdown = trackBreakdown;
		templatePlanState.loadOverview = (quiet) => void refreshOverview({ quiet });
		templatePlanState.peekOverview = (sheet) => overviewCache.get(sheet) ?? null;

		// Back in this browser tab: other devices may have synced changes meanwhile.
		const onVisible = () => {
			if (!document.hidden && drawerOpen && templatePlanState.activeTab === "overview") {
				void refreshOverview({ quiet: true });
			}
		};
		document.addEventListener("visibilitychange", onVisible);

		const stopClickListener = installClickListener();
		const stopKeyboard = installKeyboard();
		const unwatch = watchDom(tick);
		// Under another panel, Insights is out of sight, so its trigger comes back to raise it.
		const stopTop = sidepanel.onTopChange((key) => {
			if (!drawerOpen || !isBudgetPage()) {
				return;
			}
			if (key === PANEL_KEY) {
				removeTriggerButton();
			} else {
				ensureTriggerButton();
			}
		});
		// Renames and moves made while the budget page stays open.
		const stopCategories = onListChange("categories", invalidateCategoriesCache);
		const stopBudgetType = onBudgetType((type) => {
			overviewSeq++;
			prioritySeq++;
			templatePlanState.trackingBudget = type === "tracking";
			templatePlanState.priorityLoading = false;
			templatePlanState.priorityData = null;
			if (type === "tracking" && templatePlanState.activeTab === "priority") {
				templatePlanState.activeTab = "overview";
				setValue(TAB_STORAGE_KEY, "overview");
			}
			forgetAhead();
			templatePlanState.overviewData = null;
			if (drawerOpen && templatePlanState.activeTab === "overview") {
				void refreshOverview();
			}
		});

		return () => {
			controller.abort();
			session = null;
			templatePlanState.enabled = false;
			templatePlanState.trackingBudget = false;
			unwatch();
			stopTop();
			stopCategories();
			stopBudgetType();
			stopClickListener();
			stopKeyboard();
			cards.stop();
			templatePlanState.saveCards = null;
			document.removeEventListener("visibilitychange", onVisible);
			templatePlanState.customizingCards = false;
			stopWatchingCells();
			clearTimeout(monthRefresh);
			removeTriggerButton();
			// Forgets the persisted panel too, even when it's hidden on another page.
			sidepanel.close(PANEL_KEY);
			teardownPanel();
			templatePlanState.onTabChange = null;
			templatePlanState.applyTemplates = null;
			templatePlanState.trackBreakdown = null;
			templatePlanState.loadOverview = null;
			templatePlanState.peekOverview = null;
			templatePlanState.overviewData = null;
			templatePlanState.breakdownLoading = false;
			lastSheetKey = null;
			drawerOpen = false;
			wasOnBudgetPage = false;
			budgetLoaded = false;
		};
	},
});
