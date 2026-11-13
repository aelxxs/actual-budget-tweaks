import { isTrackingBudget, onBudgetType } from "@lib/utilities/budget-type";
import { readCell } from "@lib/utilities/budget-cells";
import { loadCurrency } from "@lib/utilities/currency";
import { watchDom } from "@lib/utilities/dom-watcher";
import { watchRoute } from "@lib/utilities/route-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import FlowBar from "./FlowBar.svelte";
import { AVAILABLE_FUNDS_CELL, BUDGET_SUMMARY, CELL, TO_BUDGET_CELL } from "@lib/actual-dom";

export const FLOW_BAR_CSS = `
	${BUDGET_SUMMARY} {
		border-radius: var(--border-radius);
		overflow: hidden;
		transition: box-shadow 0.15s, border-color 0.15s;
	}

	.abt-flow-hidden {
		display: none !important;
	}

	/* ── "To Budget" section styling ─────────────────────────────── */

	${BUDGET_SUMMARY} ${TO_BUDGET_CELL} span {
		font-weight: 600 !important;
	}

	.abt-to-budget-label {
		text-align: left !important;
		color: var(--color-pageTextSubdued) !important;
		font-size: var(--abt-text-sm) !important;
		padding-left: var(--abt-space-5);
	}

	.abt-to-budget-value {
		text-align: center;
	}
`;

const SHEET_RE = /budget(\d{6})/;

function getSheetName(card: HTMLElement): string | null {
	for (const el of card.querySelectorAll(CELL)) {
		const m = (el.getAttribute("data-cellname") || "").match(SHEET_RE);
		if (m) {
			return `budget${m[1]}`;
		}
	}
	return null;
}

interface FlowProps {
	available: number;
	budgeted: number;
	overspent: number;
	forNext: number;
}

// Each card's flow bar, by card; replaced when the card's numbers change.
const flows = new Map<HTMLElement, Mounted>();
// The card's shown amounts when its values were last read.
const readFor = new WeakMap<HTMLElement, string>();

function removeFlow(card: HTMLElement): void {
	flows.get(card)?.destroy();
	flows.delete(card);
	card.querySelector(".abt-flow-hidden")?.classList.remove("abt-flow-hidden");
}

function mountFlow(card: HTMLElement, after: HTMLElement, props: FlowProps, fp?: string): void {
	flows.get(card)?.destroy();
	const flow = mountToNodeWithReturn(FlowBar, props);
	flow.node.className = "abt-flow-mount";
	flow.node.style.cssText = "display: block; flex: 1;";
	if (fp) {
		flow.node.dataset.fp = fp;
	}
	after.after(flow.node);
	flows.set(card, flow);
}

async function processCard(card: HTMLElement) {
	const sheetName = getSheetName(card);

	if (!sheetName) {
		removeFlow(card);
		return;
	}

	// Style the "To Budget:" label
	const toBudgetCell = card.querySelector<HTMLElement>(TO_BUDGET_CELL);
	if (toBudgetCell) {
		const toBudgetSection = toBudgetCell.closest<HTMLElement>(`${BUDGET_SUMMARY} > div`);
		if (toBudgetSection) {
			const label = toBudgetSection.querySelector<HTMLElement>(`div:not(${CELL})`);
			if (
				label &&
				label.textContent?.includes("To Budget") &&
				!label.classList.contains("abt-to-budget-label")
			) {
				label.classList.add("abt-to-budget-label");
			}
		}
	}

	const breakdown = card
		.querySelector<HTMLElement>(AVAILABLE_FUNDS_CELL)
		?.closest<HTMLElement>(`${BUDGET_SUMMARY} > div`);
	if (!breakdown) {
		return;
	}

	// Mount immediately with zeros — no flash
	if (!flows.get(card)?.node.isConnected) {
		breakdown.classList.add("abt-flow-hidden");
		mountFlow(card, breakdown, { available: 0, budgeted: 0, overspent: 0, forNext: 0 });
		readFor.delete(card);
	}

	// The card shows the four amounts read below, so they're only re-read once its text changes;
	// otherwise every DOM change anywhere asked the backend again.
	const shown = [...card.querySelectorAll(CELL)].map((c) => c.textContent).join("|");
	if (readFor.get(card) === shown) {
		return;
	}
	readFor.set(card, shown);

	try {
		const [available, overspent, budgeted, forNext] = await Promise.all([
			readCell(sheetName, "available-funds", 0),
			readCell(sheetName, "last-month-overspent", 0),
			readCell(sheetName, "total-budgeted", 0),
			readCell(sheetName, "buffered-selected", 0),
		]);

		const absOverspent = Math.abs(overspent);
		const absBudgeted = Math.abs(budgeted);
		const absForNext = Math.abs(forNext);
		const avail = available;

		const fp = `${avail}|${absBudgeted}|${absOverspent}|${absForNext}`;
		if (flows.get(card)?.node.dataset.fp === fp) {
			return;
		}
		// Re-mounted with the real values; the zeros were already showing, so the swap is seamless.
		mountFlow(
			card,
			breakdown,
			{ available: avail, budgeted: absBudgeted, overspent: absOverspent, forNext: absForNext },
			fp,
		);
	} catch {
		// Leave zeros visible if data fetch failed, and try again on the next change.
		readFor.delete(card);
	}
}

function processCards() {
	// Actual drops cards on navigating; their bars go with them.
	for (const card of [...flows.keys()]) {
		if (!card.isConnected) {
			removeFlow(card);
		}
	}
	for (const card of document.querySelectorAll<HTMLElement>(BUDGET_SUMMARY)) {
		processCard(card);
	}
}

function cleanupCards() {
	for (const card of document.querySelectorAll<HTMLElement>(BUDGET_SUMMARY)) {
		card.classList.remove("abt-current-month");
		card.querySelector(".abt-flow-hidden")?.classList.remove("abt-flow-hidden");
	}
	for (const card of [...flows.keys()]) {
		removeFlow(card);
	}
}

/** Adds a flow bar to Actual's month cards, on envelope budgets only; returns its cleanup. */
export function startFlowBars(): () => void {
	let stopBars: (() => void) | null = null;
	let ready = false;
	const update = () => {
		if (!ready) {
			return;
		}
		if (isTrackingBudget()) {
			stopBars?.();
			stopBars = null;
		} else if (!stopBars) {
			const unwatch = watchDom(processCards);
			// Re-process when navigating back to the budget page
			const stopWatchingRoute = watchRoute(processCards);
			stopBars = () => {
				unwatch();
				stopWatchingRoute();
				cleanupCards();
			};
		}
	};
	void loadCurrency().then(() => {
		ready = true;
		update();
	});
	const stopType = onBudgetType(update);
	return () => {
		stopType();
		stopBars?.();
		stopBars = null;
	};
}
