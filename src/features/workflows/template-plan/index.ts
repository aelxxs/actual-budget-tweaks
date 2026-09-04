import { sidepanel, wasPanelPersistedOpen } from "@features/core/side-panel";
import { defineSetting } from "@features/types";
import { icon } from "@lib/icons";
import { loadCurrency } from "@lib/utilities/currency";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { getValue, setValue } from "@lib/utilities/store";
import {
	diffSnapshots,
	finishSnapshots,
	getCells,
	getCurrentSheet,
	invalidateCategoriesCache,
	isBudgetPage,
	loadCategories,
	loadTemplatesByCategoryId,
	sheetToMonthKey,
	sheetToMonthLabel,
	startSnapshotAllVisible,
	waitForQuiescence,
	type SnapshotDescriptor,
} from "@lib/utilities/template-plan/actual-data";
import { createPriorityPlanner } from "@lib/utilities/template-plan/priority-plan";
import { query, send } from "@lib/utilities/actual-api";
import type { Schedule } from "@lib/types/actual-schema";
import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import { unmount } from "svelte";
import {
	BREAKDOWN_STORAGE_KEY,
	PRIO_COLLAPSE_STORAGE_KEY,
	SIDE_PANEL_WIDTH,
	TAB_STORAGE_KEY,
	TRIGGER_LABELS,
} from "./constants";
import { CSS } from "./css";
import {
	templatePlanState,
	type BreakdownState,
	type MonthTrend,
	type OverviewCategoryRow,
	type OverviewSchedule,
} from "./state.svelte";
import TemplatePlanPanel from "./TemplatePlanPanel.svelte";

const TRIGGER_ID = "abt-template-plan-trigger";

const priorityPlanner = createPriorityPlanner({
	getCurrentSheet,
	isBudgetPage,
	loadCategories,
	loadTemplatesByCategoryId,
	getCells,
	sheetToMonthKey,
	sheetToMonthLabel,
});
const { computePriorityStatus, buildBreakdownPrioritySummary, invalidatePriorityStatus } =
	priorityPlanner;

// ── Panel mount (built once, reused across opens) ────────────────────
let bodyContainer: HTMLElement | null = null;
let panelInstance: ReturnType<typeof mountToNodeWithReturn>["instance"] | null = null;

function ensurePanelMounted(): HTMLElement {
	if (!bodyContainer) {
		const { node, instance } = mountToNodeWithReturn(TemplatePlanPanel, {});
		// The side panel's own body already scrolls by default (for consumers with
		// no internal layout of their own) — clip our wrapper so only our internal
		// .abt-tab-body scrolls, keeping the tabs/footer/toggle pinned in place.
		node.style.cssText =
			"display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;";
		bodyContainer = node;
		panelInstance = instance;
	}
	return bodyContainer;
}

function teardownPanel(): void {
	if (panelInstance) {
		unmount(panelInstance);
		panelInstance = null;
	}
	bodyContainer = null;
}

// ── Trigger button ────────────────────────────────────────────────────
let triggerBtn: HTMLButtonElement | null = null;

function ensureTriggerButton(): void {
	if (document.getElementById(TRIGGER_ID)) return;
	const btn = document.createElement("button");
	btn.id = TRIGGER_ID;
	btn.className = "abt-template-drawer-trigger";
	btn.type = "button";
	btn.title = "Open template plan";
	btn.setAttribute("aria-label", "Open template plan");
	btn.innerHTML = icon("chevronLeft", { size: 14 });
	btn.appendChild(document.createTextNode("Plan"));
	btn.addEventListener("click", () => openPanel());
	document.body.appendChild(btn);
	triggerBtn = btn;
}

function removeTriggerButton(): void {
	triggerBtn?.remove();
	triggerBtn = null;
}

// ── Drawer open/close ─────────────────────────────────────────────────
let drawerOpen = false;

function openPanel(): void {
	drawerOpen = true;
	removeTriggerButton();
	const bodyNode = ensurePanelMounted();
	sidepanel.open({ bodyNode, persist: true, width: SIDE_PANEL_WIDTH });
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

// Repopulates the panel if it was persisted open for this route, otherwise
// falls back to just showing the trigger button. See wasPanelPersistedOpen's
// doc for why this can't just check sidepanel.isOpen() instead.
function reopenIfPersisted(): void {
	wasPanelPersistedOpen().then((persisted) => {
		if (persisted) {
			if (!drawerOpen) openPanel();
		} else if (!drawerOpen) {
			ensureTriggerButton();
		}
	});
}

function closePanel(): void {
	drawerOpen = false;
	sidepanel.close();
	if (isBudgetPage()) ensureTriggerButton();
}

// ── Persisted UI state ────────────────────────────────────────────────
async function loadPersistedState(): Promise<void> {
	const tab = await getValue<"breakdown" | "priority" | "overview">(TAB_STORAGE_KEY, "overview");
	if (tab === "breakdown" || tab === "priority" || tab === "overview")
		templatePlanState.activeTab = tab;

	const collapse = await getValue<Record<string, boolean>>(PRIO_COLLAPSE_STORAGE_KEY, {});
	for (const [k, v] of Object.entries(collapse)) {
		if (typeof v === "boolean") templatePlanState.prioCollapseOverrides[k] = v;
	}

	const saved = await getValue<BreakdownState | null>(BREAKDOWN_STORAGE_KEY, null);
	if (saved) templatePlanState.breakdownState = saved;
}

function saveBreakdown(): void {
	if (templatePlanState.breakdownState) {
		setValue(BREAKDOWN_STORAGE_KEY, templatePlanState.breakdownState);
	}
}

// ── Overview refresh ──────────────────────────────────────────────────
async function refreshOverview(): Promise<void> {
	if (!isBudgetPage()) return;
	templatePlanState.overviewLoading = true;
	try {
		const sheet = getCurrentSheet();
		if (!sheet) {
			templatePlanState.overviewData = null;
			return;
		}

		const cats = await loadCategories();
		const visibleCats = cats.filter((c) => !c.hidden);

		const cellNames = [
			"to-budget",
			"total-budgeted",
			"available-funds",
			"last-month-overspent",
			"buffered-selected",
			...visibleCats.map((c) => `sum-amount-${c.id}`),
			...visibleCats.map((c) => `leftover-${c.id}`),
			...visibleCats.map((c) => `budget-${c.id}`),
			...visibleCats.map((c) => `goal-${c.id}`),
		];

		const [cells, schedulesResult] = await Promise.all([
			getCells(sheet, cellNames),
			query<Schedule[]>("schedules", { filter: { tombstone: false, completed: false } }),
		]);

		const toBudget = cells.get("to-budget") ?? 0;
		const totalBudgeted = Math.abs(cells.get("total-budgeted") ?? 0);
		const availableFunds = cells.get("available-funds") ?? toBudget + totalBudgeted;
		const lastMonthOverspent = cells.get("last-month-overspent") ?? 0;
		const bufferedSelected = cells.get("buffered-selected") ?? 0;

		let totalSpent = 0;
		const overspentCategories: OverviewCategoryRow[] = [];
		const underfundedGoals: OverviewCategoryRow[] = [];
		let fullyFundedGoalCount = 0;
		let totalGoalCount = 0;

		for (const cat of visibleCats) {
			const sumAmount = cells.get(`sum-amount-${cat.id}`) ?? 0;
			const leftover = cells.get(`leftover-${cat.id}`) ?? 0;
			const budgeted = cells.get(`budget-${cat.id}`) ?? 0;
			const goal = cells.get(`goal-${cat.id}`) ?? 0;

			if (sumAmount < 0) totalSpent += Math.abs(sumAmount);

			if (leftover < 0) {
				overspentCategories.push({
					id: cat.id,
					name: cat.name,
					groupName: cat.group_name,
					leftover,
				});
			}

			// A goal can be met either by this month's assignment (recurring spend
			// goals like rent, where the balance is expected to be drawn to 0) or
			// by the running balance (savings goals like an emergency fund, which
			// stay funded even in a month nothing new is budgeted).
			const goalProgress = Math.max(leftover, budgeted);
			if (goal > 0) {
				totalGoalCount++;
				if (goalProgress >= goal) {
					fullyFundedGoalCount++;
				} else {
					underfundedGoals.push({
						id: cat.id,
						name: cat.name,
						groupName: cat.group_name,
						leftover: goalProgress,
						goal,
					});
				}
			}
		}

		overspentCategories.sort((a, b) => a.leftover - b.leftover);
		underfundedGoals.sort((a, b) => a.leftover - (a.goal ?? 0) - (b.leftover - (b.goal ?? 0)));

		const today = new Date();
		const todayStr = today.toISOString().slice(0, 10);
		const futureStr = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);

		const upcomingSchedules: OverviewSchedule[] = (schedulesResult ?? [])
			.filter((s) => s.next_date && s.next_date >= todayStr && s.next_date <= futureStr)
			.sort((a, b) => (a.next_date ?? "").localeCompare(b.next_date ?? ""))
			.slice(0, 12)
			.map((s) => ({ id: s.id, name: s.name ?? "Unnamed", nextDate: s.next_date! }));

		// ── Historical trend + next-month coverage ────────────────────────
		const currentMonthKey = sheetToMonthKey(sheet) ?? "";
		const [currY, currM] = currentMonthKey.split("-").map(Number);

		const offsetKey = (offsetMonths: number): string => {
			const d = new Date(currY, currM - 1 + offsetMonths, 1);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		};
		const keyToSheet = (key: string) => `budget${key.replace("-", "")}`;

		const pastKeys = [-5, -4, -3, -2, -1, 0].map(offsetKey);
		const nextMonthKey = offsetKey(1);
		const trendNames = [
			"to-budget",
			"total-budgeted",
			...visibleCats.map((c) => `sum-amount-${c.id}`),
		];

		const [pastResults, nextResult] = await Promise.all([
			Promise.all(pastKeys.map((k) => getCells(keyToSheet(k), trendNames))),
			getCells(keyToSheet(nextMonthKey), ["to-budget"]),
		]);

		const trend: MonthTrend[] = pastKeys.map((key, i) => {
			const mc = i === 5 ? cells : pastResults[i]; // reuse current-month cells
			let spent = 0;
			for (const cat of visibleCats) {
				const s = mc.get(`sum-amount-${cat.id}`) ?? 0;
				if (s < 0) spent += Math.abs(s);
			}
			return {
				monthKey: key,
				budgeted: Math.abs(mc.get("total-budgeted") ?? 0),
				toBudget: mc.get("to-budget") ?? 0,
				spent,
			};
		});

		const nonZeroRecent = trend
			.slice(0, 5)
			.filter((t) => t.spent > 0)
			.slice(-3);
		const recentAvgSpending =
			nonZeroRecent.length > 0
				? nonZeroRecent.reduce((s, t) => s + t.spent, 0) / nonZeroRecent.length
				: totalBudgeted;

		const nextMonthToBudget = nextResult.get("to-budget") ?? 0;

		templatePlanState.overviewData = {
			sheet,
			monthKey: currentMonthKey,
			availableFunds,
			toBudget,
			totalBudgeted,
			totalSpent,
			lastMonthOverspent,
			bufferedSelected,
			overspentCategories,
			underfundedGoals,
			fullyFundedGoalCount,
			totalGoalCount,
			upcomingSchedules,
			trend,
			nextMonthKey,
			nextMonthToBudget,
			recentAvgSpending,
		};
	} catch (e) {
		console.warn("[ABT] overview refresh failed", e);
	} finally {
		templatePlanState.overviewLoading = false;
	}
}

// ── Priority refresh ──────────────────────────────────────────────────
async function refreshPriorityIfNeeded(): Promise<void> {
	if (!isBudgetPage()) return;
	templatePlanState.priorityLoading = true;
	try {
		// Use the direct result rather than getPriorityCache() — early-exit
		// branches (no visible sheet yet, not on budget page) resolve with an
		// { ok: false } status without ever populating the module-level cache,
		// which previously left priorityData stuck at null (endless spinner)
		// until something else happened to populate the cache.
		templatePlanState.priorityData = await computePriorityStatus(false);
	} catch (e) {
		console.warn("[ABT] template plan priority compute failed", e);
		templatePlanState.priorityData = {
			ok: false,
			reason: "failed to compute",
			computedAt: Date.now(),
		};
	} finally {
		templatePlanState.priorityLoading = false;
	}
}

// ── Click interception (apply/overwrite) ─────────────────────────────
let runSeq = 0;

function classifyTrigger(target: EventTarget | null) {
	if (!target) return null;
	const btn = (target as HTMLElement).closest?.("button");
	if (!btn) return null;
	const text = (btn.textContent || "").trim().toLowerCase();
	if (!text) return null;
	return TRIGGER_LABELS.get(text) ?? null;
}

async function handleTrigger(
	kind: BreakdownState["ctx"]["kind"],
	beforeStarts: SnapshotDescriptor[],
	doWork?: () => Promise<void>,
): Promise<void> {
	const seq = ++runSeq;
	templatePlanState.breakdownLoading = true;
	if (templatePlanState.activeTab !== "breakdown") {
		templatePlanState.activeTab = "breakdown";
		setValue(TAB_STORAGE_KEY, "breakdown");
	}
	if (!drawerOpen) openPanel();

	let beforeMap;
	try {
		beforeMap = await finishSnapshots(beforeStarts);
	} catch (e) {
		console.warn("[ABT] template plan snapshot before failed", e);
		templatePlanState.breakdownLoading = false;
		return;
	}

	if (doWork) {
		try {
			await doWork();
		} catch (e) {
			console.warn("[ABT] template plan apply failed", e);
			templatePlanState.breakdownLoading = false;
			return;
		}
	}

	// Wait for Actual's reactive spreadsheet + React to propagate the updated
	// cell values to the DOM — whether triggered by a button click or a direct
	// send() call.
	try {
		await waitForQuiescence();
	} catch {
		// best-effort
	}
	if (seq !== runSeq) return;

	let afterMap;
	try {
		afterMap = await finishSnapshots(startSnapshotAllVisible());
	} catch (e) {
		console.warn("[ABT] template plan snapshot after failed", e);
		templatePlanState.breakdownLoading = false;
		return;
	}
	if (seq !== runSeq) return;

	let bestDiff: ReturnType<typeof diffSnapshots> | null = null;
	let bestSheet: string | null = null;
	let bestScore = 0;
	const sheets = new Set([...beforeMap.keys(), ...afterMap.keys()]);
	for (const sheet of sheets) {
		const before = beforeMap.get(sheet);
		const after = afterMap.get(sheet);
		if (!before || !after) continue;
		const d = diffSnapshots(before, after);
		const score = d.groups.reduce(
			(acc, g) => acc + g.rows.reduce((a, r) => a + Math.abs(r.delta), 0),
			0,
		);
		if (score > bestScore) {
			bestScore = score;
			bestDiff = d;
			bestSheet = sheet;
		}
	}

	templatePlanState.breakdownLoading = false;
	let priorityBreakdown = null;
	const prioritySheet = bestSheet || afterMap.keys().next().value || null;
	const priorityDiff = bestDiff || null;
	if (prioritySheet && priorityDiff) {
		try {
			priorityBreakdown = await buildBreakdownPrioritySummary(prioritySheet, priorityDiff);
		} catch (e) {
			console.warn("[ABT] template plan priority breakdown failed", e);
		}
	}

	const fallbackSheet = afterMap.keys().next().value || null;
	const diff =
		bestDiff ||
		({
			groups: [],
			totalAllocated: 0,
			availableBefore: 0,
			availableAfter: 0,
			toBudgetBefore: 0,
			toBudgetAfter: 0,
		} as ReturnType<typeof diffSnapshots>);

	templatePlanState.breakdownState = {
		diff,
		ctx: {
			kind,
			month: sheetToMonthLabel(bestSheet || fallbackSheet || ""),
			notification: null,
			priorityBreakdown,
		},
	};
	saveBreakdown();

	templatePlanState.overviewData = null;
	invalidatePriorityStatus();
	refreshPriorityIfNeeded();
}

function installClickListener(): () => void {
	const handler = (ev: MouseEvent) => {
		if (!matchesPage(Page.Budget)) return;
		const kind = classifyTrigger(ev.target);
		if (!kind) return;
		const beforeStarts = startSnapshotAllVisible();
		handleTrigger(kind, beforeStarts);
	};
	document.addEventListener("click", handler, true);
	return () => document.removeEventListener("click", handler, true);
}

function installKeyboard(): () => void {
	const handler = (ev: KeyboardEvent) => {
		if (ev.key !== "Escape") return;
		if (!drawerOpen || !isBudgetPage()) return;
		closePanel();
	};
	document.addEventListener("keydown", handler);
	return () => document.removeEventListener("keydown", handler);
}

// ── Sheet-change polling (horizontal scroll between months doesn't
// always fire a DOM mutation, so this can't ride on watchDom alone) ──
let lastSheetKey: string | null = null;

function pollSheetChange(): void {
	if (!matchesPage(Page.Budget)) return;
	const sheet = getCurrentSheet();
	const key = sheet ? sheetToMonthKey(sheet) : null;
	if (key === lastSheetKey) return;
	lastSheetKey = key;
	invalidatePriorityStatus();
	templatePlanState.overviewData = null;
	if (drawerOpen) {
		if (templatePlanState.activeTab === "priority") refreshPriorityIfNeeded();
		else if (templatePlanState.activeTab === "overview") refreshOverview();
	}
}

// ── Page gating ────────────────────────────────────────────────────────
let wasOnBudgetPage = false;

function tick(): void {
	if (!matchesPage(Page.Budget)) {
		if (wasOnBudgetPage) {
			wasOnBudgetPage = false;
			drawerOpen = false;
			removeTriggerButton();
			sidepanel.close();
		}
		return;
	}

	if (!wasOnBudgetPage) {
		wasOnBudgetPage = true;
		invalidateCategoriesCache();
		// Panel may already be persisted open from a previous session on this
		// route — repopulate it with our content instead of assuming closed.
		reopenIfPersisted();
	}

	// The side panel's built-in close (X) button has no notification hook,
	// so detect it by polling isOpen() against our tracked state.
	if (drawerOpen && !sidepanel.isOpen()) {
		drawerOpen = false;
		ensureTriggerButton();
	}
}

export const templatePlan = defineSetting({
	type: "checkbox",
	label: "Template Plan",
	description: "Side panel breakdown after applying or overwriting budget templates.",
	icon: "layout",
	context: {
		key: "actual-template-apply-breakdown",
		defaultValue: true,
	},
	css: () => CSS,
	init: async () => {
		loadCurrency();
		await loadPersistedState();
		// Not awaited: loadCategories() internally waits for the budget page's
		// DOM to be ready, which never resolves if the user lands directly on
		// a different page (e.g. settings). bootstrapSettings() awaits every
		// feature's init via Promise.all, so blocking here would hang the
		// entire settings panel's mount, not just this feature.
		loadCategories();

		templatePlanState.onTabChange = (tab) => {
			if (tab === "overview") refreshOverview();
			else if (tab === "priority") refreshPriorityIfNeeded();
		};

		templatePlanState.applyTemplates = async () => {
			if (!isBudgetPage()) return;
			const sheet = getCurrentSheet();
			const month = sheet ? sheetToMonthKey(sheet) : null;
			if (!month) return;
			const beforeStarts = startSnapshotAllVisible();
			await handleTrigger("apply", beforeStarts, () =>
				send("budget/apply-goal-template", { month }),
			);
		};

		const stopClickListener = installClickListener();
		const stopKeyboard = installKeyboard();
		const unwatch = watchDom(tick);
		const pollInterval = setInterval(pollSheetChange, 1500);

		if (matchesPage(Page.Budget)) {
			wasOnBudgetPage = true;
			reopenIfPersisted();
		}

		return () => {
			unwatch();
			stopClickListener();
			stopKeyboard();
			clearInterval(pollInterval);
			removeTriggerButton();
			teardownPanel();
			templatePlanState.onTabChange = null;
			templatePlanState.applyTemplates = null;
			templatePlanState.overviewData = null;
			drawerOpen = false;
			wasOnBudgetPage = false;
		};
	},
});
