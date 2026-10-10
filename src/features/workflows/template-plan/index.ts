import { isPanelPersistedOpen, sidepanel, wasPanelPersistedOpen } from "@features/core/side-panel";
import { defineSetting } from "@features/types";
import { icon } from "@lib/icons";
import type { Schedule } from "@lib/types/actual-schema";
import { loadCurrentBudgetId, notify, query, send } from "@lib/utilities/actual-api";
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
import { getValue, removeValue, setValue } from "@lib/utilities/store";
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
} from "@lib/utilities/template-plan/actual-data";
import { previewMonthTemplateTotal } from "@lib/utilities/template-plan/next-month-coverage";
import { createPriorityPlanner } from "@lib/utilities/template-plan/priority-plan";
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
	monthCellNames,
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
} from "./state.svelte";
import TemplatePlanPanel from "./TemplatePlanPanel.svelte";

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

function ensurePanelMounted(): HTMLElement {
	panel ??= mountToPanelBody(TemplatePlanPanel, {});
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
	openPanel();
}

// ── Drawer open/close ─────────────────────────────────────────────────
let drawerOpen = false;
let drawerMounted = false;

function openPanel(animate = true): void {
	if (!session || !isBudgetPage()) {
		return;
	}
	drawerOpen = true;
	drawerMounted = false;
	removeTriggerButton();
	const bodyNode = ensurePanelMounted();
	sidepanel.open({ bodyNode, persist: true, width: SIDE_PANEL_WIDTH, animate });
	if (
		templatePlanState.activeTab === "overview" &&
		!templatePlanState.overviewLoading &&
		!templatePlanState.overviewData
	) {
		refreshOverview();
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
				openPanel(false);
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
async function refreshOverview({ quiet = false }: { quiet?: boolean } = {}): Promise<void> {
	if (!isBudgetPage()) {
		return;
	}
	const seq = ++overviewSeq;
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

		const [
			cells,
			schedules,
			pastCells,
			nextCells,
			nextMonthGoalTotal,
			templateRemaining,
			templates,
		] = await Promise.all([
			readCells(sheet, monthCellNames(cats)),
			query<Schedule[]>("schedules", { filter: { tombstone: false, completed: false } }),
			Promise.all(months.slice(0, -1).map((k) => readCells(monthToSheet(k), trendCellNames(cats)))),
			readCells(monthToSheet(nextMonthKey), ["to-budget"]),
			previewMonthTemplateTotal(nextMonthKey, cats),
			// What Apply would still assign this month; goal cells only fill once it has run.
			previewMonthTemplateTotal(monthKey, cats),
			loadTemplatesByCategoryId(),
		]);

		const toBudget = cells.get("to-budget") ?? 0;
		const totalBudgeted = Math.abs(cells.get("total-budgeted") ?? 0);
		const trend = buildTrend(months, [...pastCells, cells], cats);

		if (seq !== overviewSeq) {
			return;
		}
		templatePlanState.overviewData = {
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
			nextMonthToBudget: nextCells.get("to-budget") ?? 0,
			nextMonthGoalTotal,
			recentAvgSpending: recentAverageSpending(trend, totalBudgeted),
			templateRemaining,
			hasTemplates: cats.some((c) => templates.has(c.id)),
		};
	} catch (e) {
		console.warn("[ABT] overview refresh failed", e);
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
		console.warn("[ABT] template plan priority compute failed", e);
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

async function handleTrigger(
	kind: BreakdownState["ctx"]["kind"],
	beforeStarts: SnapshotDescriptor[],
	doWork?: () => Promise<void>,
): Promise<void> {
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

	try {
		const beforeMap = await finishSnapshots(beforeStarts);
		if (doWork) {
			try {
				await doWork();
			} catch (e) {
				void notify({ type: "error", message: "Couldn't apply templates", pre: String(e) });
				return;
			}
		}
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

		const priorityBreakdown =
			sheet && diff
				? await buildBreakdownPrioritySummary(sheet, diff).catch((e) => {
						console.warn("[ABT] template plan priority breakdown failed", e);
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
	} catch (e) {
		console.warn("[ABT] template plan breakdown failed", e);
	} finally {
		if (seq === runSeq) {
			templatePlanState.breakdownLoading = false;
		}
	}
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
function onTableChange({ changed }: BudgetTableChange): void {
	// Every batch, not only `moved` ones: the cells' sheet names can settle a render after the header.
	checkSheetChange();
	if (!drawerOpen || templatePlanState.activeTab !== "overview") {
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
	const loaded = !!document.querySelector('a[href="/budget"]');
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

	if (!wasOnBudgetPage) {
		wasOnBudgetPage = true;
		invalidateCategoriesCache();
		// Left open last time: refilled synchronously once known, so it's back before the page paints.
		const persisted = isPanelPersistedOpen();
		if (persisted === undefined) {
			reopenIfPersisted();
		} else if (!drawerOpen) {
			if (persisted) {
				openPanel(false);
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
			await handleTrigger("apply", beforeStarts, () =>
				send("budget/apply-goal-template", { month }),
			);
		};

		const stopClickListener = installClickListener();
		const stopKeyboard = installKeyboard();
		const unwatch = watchDom(tick);

		return () => {
			controller.abort();
			session = null;
			templatePlanState.enabled = false;
			unwatch();
			stopClickListener();
			stopKeyboard();
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
			templatePlanState.overviewData = null;
			templatePlanState.breakdownLoading = false;
			lastSheetKey = null;
			drawerOpen = false;
			wasOnBudgetPage = false;
			budgetLoaded = false;
		};
	},
});
