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
import { watchDom } from "@lib/utilities/dom-watcher";
import { addMonths, monthToSheet, sheetToMonth } from "@lib/utilities/months";
import { Page, matchesPage } from "@lib/utilities/pages";
import { getValue, removeValue, setValue, watchValue } from "@lib/utilities/store";
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
	SIDE_PANEL_WIDTH,
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
	sidepanel.open({ title: panelTitle, bodyNode, persist: true, width: SIDE_PANEL_WIDTH });
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
	sidepanel.close();
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
 * Walks already done, by the month and the figures they started from, so going back to a month
 * shows its months ahead at once. An edit clears them: it can change a later month's need alone.
 */
const aheadCache = new Map<string, number[]>();

async function refreshOverview({ quiet = false }: { quiet?: boolean } = {}): Promise<void> {
	if (!isBudgetPage()) {
		return;
	}
	const seq = ++overviewSeq;
	const previous = templatePlanState.overviewData;
	// Quiet refreshes follow edits.
	if (quiet) {
		aheadCache.clear();
	}
	if (!quiet) {
		templatePlanState.overviewLoading = true;
	}
	try {
		const sheet = getCurrentSheet();
		if (!sheet) {
			templatePlanState.overviewData = null;
			return;
		}

		const cats = (await loadCategories()).filter((c) => !c.hidden);
		const monthKey = sheetToMonth(sheet) ?? "";
		const months = trendMonths(monthKey);
		const nextMonthKey = addMonths(monthKey, 1);

		const [cells, schedules, pastCells, nextCells, nextMonthGoalTotal, templatePreview, templates] =
			await Promise.all([
				readCells(sheet, monthCellNames(cats)),
				query<Schedule[]>("schedules", { filter: { tombstone: false, completed: false } }),
				Promise.all(
					months.slice(0, -1).map((k) => readCells(monthToSheet(k), trendCellNames(cats))),
				),
				readCells(monthToSheet(nextMonthKey), ["total-budgeted"]),
				previewMonthTemplateTotal(nextMonthKey, cats),
				// Goal cells can't tell what's left: they fill once templates run, and Actual can set them
				// without budgeting anything (actualbudget/actual#9304).
				previewMonthTemplates(monthKey, cats),
				loadTemplatesByCategoryId(),
			]);

		const toBudget = cells.get("to-budget") ?? 0;
		const totalBudgeted = Math.abs(cells.get("total-budgeted") ?? 0);
		const trend = buildTrend(months, [...pastCells, cells], cats);

		const data: OverviewData = {
			sheet,
			monthKey,
			availableFunds: cells.get("available-funds") ?? toBudget + totalBudgeted,
			toBudget,
			totalBudgeted,
			lastMonthOverspent: cells.get("last-month-overspent") ?? 0,
			bufferedSelected: cells.get("buffered-selected") ?? 0,
			...summarizeCategories(cats, cells),
			upcomingSchedules: upcomingSchedules(schedules ?? []),
			trend,
			nextMonthKey,
			nextMonthBudgeted: Math.abs(nextCells.get("total-budgeted") ?? 0),
			nextMonthGoalTotal,
			recentAvgSpending: recentAverageSpending(trend, totalBudgeted),
			templateRemaining: templatePreview?.remaining ?? null,
			templateToApply: templatePreview?.onApply ?? null,
			hasTemplates: cats.some((c) => templates.has(c.id)),
			// An edit keeps the last walk on screen until the new one is in; another month waits.
			aheadTemplateNeeds:
				quiet && previous?.monthKey === monthKey ? previous.aheadTemplateNeeds : null,
		};
		if (seq !== overviewSeq) {
			return;
		}
		// Nothing to walk without money past next month, so there's nothing to wait for.
		const need = nextMonthGoalNeed(data);
		if (!data.hasTemplates || need === null || heldForNextMonth(data) <= need) {
			templatePlanState.overviewData = { ...data, aheadTemplateNeeds: [] };
			return;
		}
		const key = [monthKey, heldForNextMonth(data), need].join();
		const cached = aheadCache.get(key);
		if (cached) {
			templatePlanState.overviewData = { ...data, aheadTemplateNeeds: cached };
			return;
		}
		// The rest of the overview shows now; the months ahead are slower, and follow.
		templatePlanState.overviewData = data;
		templatePlanState.overviewLoading = false;
		const ahead = await aheadTemplateNeeds(data, cats, templates, () => seq !== overviewSeq);
		if (seq !== overviewSeq) {
			return;
		}
		aheadCache.set(key, ahead);
		templatePlanState.overviewData = { ...data, aheadTemplateNeeds: ahead };
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
		overviewSeq++;
		prioritySeq++;
		templatePlanState.overviewLoading = false;
		templatePlanState.priorityLoading = false;
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
		if (sidepanel.isOpen()) {
			drawerMounted = true;
		} else if (drawerMounted) {
			drawerOpen = false;
			ensureTriggerButton();
		}
	}
}

export const templatePlan = defineSetting({
	type: "checkbox",
	envelopeOnly: true,
	label: "Budget Insights",
	description: "Month summary, template breakdowns, and priority planning in a side panel.",
	icon: "layout",
	group: "Budget",
	writes: "Applies the month's budget templates when you click Apply.",
	context: {
		key: "actual-template-apply-breakdown",
		defaultValue: true,
	},
	css: () => CSS,
	init: async () => {
		const controller = new AbortController();
		session = controller.signal;
		templatePlanState.enabled = true;
		loadCurrency();
		await loadPersistedState();
		templatePlanState.cards = toLayout(await getValue<unknown>(CARDS_KEY, null));
		// Another device's change, through settings sync.
		const stopCards = watchValue<unknown>(
			CARDS_KEY,
			(v) => (templatePlanState.cards = toLayout(v)),
		);
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
		// Renames and moves made while the budget page stays open.
		const stopCategories = onListChange("categories", invalidateCategoriesCache);

		return () => {
			controller.abort();
			session = null;
			templatePlanState.enabled = false;
			unwatch();
			stopCategories();
			stopClickListener();
			stopKeyboard();
			stopCards();
			document.removeEventListener("visibilitychange", onVisible);
			templatePlanState.customizingCards = false;
			stopWatchingCells();
			clearTimeout(monthRefresh);
			removeTriggerButton();
			if (drawerOpen) {
				sidepanel.close();
				sidepanel.dismiss();
			}
			teardownPanel();
			templatePlanState.onTabChange = null;
			templatePlanState.applyTemplates = null;
			templatePlanState.trackBreakdown = null;
			templatePlanState.overviewData = null;
			templatePlanState.breakdownLoading = false;
			lastSheetKey = null;
			drawerOpen = false;
			wasOnBudgetPage = false;
			budgetLoaded = false;
		};
	},
});
