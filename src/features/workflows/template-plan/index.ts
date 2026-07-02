import { sidepanel } from "@features/core/side-panel";
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
import { templatePlanState, type BreakdownState } from "./state.svelte";
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
const { computePriorityStatus, buildBreakdownPrioritySummary, invalidatePriorityStatus } = priorityPlanner;

// ── Panel mount (built once, reused across opens) ────────────────────
let bodyContainer: HTMLElement | null = null;
let panelInstance: ReturnType<typeof mountToNodeWithReturn>["instance"] | null = null;

function ensurePanelMounted(): HTMLElement {
	if (!bodyContainer) {
		const { node, instance } = mountToNodeWithReturn(TemplatePlanPanel, {});
		// The side panel's own body already scrolls by default (for consumers with
		// no internal layout of their own) — clip our wrapper so only our internal
		// .abt-tab-body scrolls, keeping the tabs/footer/toggle pinned in place.
		node.style.cssText = "display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;";
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
	if (templatePlanState.activeTab === "priority" && !templatePlanState.priorityLoading && !templatePlanState.priorityData) {
		refreshPriorityIfNeeded();
	}
}

function closePanel(): void {
	drawerOpen = false;
	sidepanel.close();
	if (isBudgetPage()) ensureTriggerButton();
}

// ── Persisted UI state ────────────────────────────────────────────────
async function loadPersistedState(): Promise<void> {
	const tab = await getValue<"breakdown" | "priority">(TAB_STORAGE_KEY, "priority");
	if (tab === "breakdown" || tab === "priority") templatePlanState.activeTab = tab;

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
		templatePlanState.priorityData = { ok: false, reason: "failed to compute", computedAt: Date.now() };
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

async function handleTrigger(kind: BreakdownState["ctx"]["kind"], beforeStarts: SnapshotDescriptor[]): Promise<void> {
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
		const score = d.groups.reduce((acc, g) => acc + g.rows.reduce((a, r) => a + Math.abs(r.delta), 0), 0);
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
	if (drawerOpen && templatePlanState.activeTab === "priority") {
		refreshPriorityIfNeeded();
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
		// Panel may already be open from a persisted route match (side-panel's
		// own rehydration) — populate it with our content instead of assuming closed.
		if (sidepanel.isOpen()) {
			openPanel();
		} else if (!drawerOpen) {
			ensureTriggerButton();
		}
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

		const stopClickListener = installClickListener();
		const stopKeyboard = installKeyboard();
		const unwatch = watchDom(tick);
		const pollInterval = setInterval(pollSheetChange, 1500);

		if (matchesPage(Page.Budget)) {
			wasOnBudgetPage = true;
			if (sidepanel.isOpen()) {
				openPanel();
			} else {
				ensureTriggerButton();
			}
		}

		return () => {
			unwatch();
			stopClickListener();
			stopKeyboard();
			clearInterval(pollInterval);
			removeTriggerButton();
			teardownPanel();
			drawerOpen = false;
			wasOnBudgetPage = false;
		};
	},
});
