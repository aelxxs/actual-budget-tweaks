import { defineSetting } from "@features/types";
import BudgetCardStylingPreview from "../previews/BudgetCardStyling.svelte";
import { readCell } from "@lib/utilities/budget-cells";
import { loadCurrency } from "@lib/utilities/currency";
import { watchDom } from "@lib/utilities/dom-watcher";
import { watchRoute } from "@lib/utilities/route-watcher";
import { mountToNode } from "@lib/utilities/svelte";
import FlowBar from "./FlowBar.svelte";

const CSS = `
	[data-testid="budget-summary"] {
		border-radius: var(--border-radius);
		overflow: hidden;
		transition: box-shadow 0.15s, border-color 0.15s;
	}

	.abt-flow-hidden {
		display: none !important;
	}

	/* ── "To Budget" section styling ─────────────────────────────── */

	[data-testid="budget-summary"] [data-cellname*="object Object"] span {
		font-weight: 600 !important;
	}

	.abt-to-budget-label {
		text-align: left !important;
		color: var(--color-pageTextSubdued) !important;
		font-size: var(--abt-text-sm) !important;
		padding-left: 16px;
	}

	.abt-to-budget-value {
		text-align: center;
	}
`;

const SHEET_RE = /budget(\d{6})/;

function getSheetName(card: HTMLElement): string | null {
	for (const el of card.querySelectorAll("[data-cellname]")) {
		const m = (el.getAttribute("data-cellname") || "").match(SHEET_RE);
		if (m) {
			return `budget${m[1]}`;
		}
	}
	return null;
}

async function processCard(card: HTMLElement) {
	const sheetName = getSheetName(card);

	if (!sheetName) {
		card.querySelector(".abt-flow-mount")?.remove();
		card.querySelector(".abt-flow-hidden")?.classList.remove("abt-flow-hidden");
		return;
	}

	// Style the "To Budget:" label
	const toBudgetCell = card.querySelector<HTMLElement>('[data-cellname*="object Object"]');
	if (toBudgetCell) {
		const toBudgetSection = toBudgetCell.closest<HTMLElement>(
			'[data-testid="budget-summary"] > div',
		);
		if (toBudgetSection) {
			const label = toBudgetSection.querySelector<HTMLElement>("div:not([data-cellname])");
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
		.querySelector<HTMLElement>('[data-cellname*="!available-funds"]')
		?.closest<HTMLElement>('[data-testid="budget-summary"] > div');
	if (!breakdown) {
		return;
	}

	// Mount immediately with zeros — no flash
	const existing = card.querySelector<HTMLElement>(".abt-flow-mount");
	if (!existing) {
		breakdown.classList.add("abt-flow-hidden");
		const wrapper = mountToNode(FlowBar, { available: 0, budgeted: 0, overspent: 0, forNext: 0 });
		wrapper.className = "abt-flow-mount";
		wrapper.style.display = "block";
		breakdown.after(wrapper);
	}

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
		const mount = card.querySelector<HTMLElement>(".abt-flow-mount");
		if (mount?.dataset.fp === fp) {
			return;
		}
		if (mount) {
			mount.dataset.fp = fp;
		}

		// Re-mount with real values — FlowBar is already visible so swap is seamless
		mount?.remove();
		const wrapper = mountToNode(FlowBar, {
			available: avail,
			budgeted: absBudgeted,
			overspent: absOverspent,
			forNext: absForNext,
		});
		wrapper.className = "abt-flow-mount";
		wrapper.style.display = "block";
		wrapper.dataset.fp = fp;
		breakdown.after(wrapper);
	} catch {
		// Leave zeros visible if data fetch failed
	}
}

function processCards() {
	for (const card of document.querySelectorAll<HTMLElement>('[data-testid="budget-summary"]')) {
		processCard(card);
	}
}

function cleanupCards() {
	for (const card of document.querySelectorAll<HTMLElement>('[data-testid="budget-summary"]')) {
		card.classList.remove("abt-current-month");
		card.querySelector(".abt-flow-mount")?.remove();
		card.querySelector(".abt-flow-hidden")?.classList.remove("abt-flow-hidden");
	}
}

export const budgetCardStyling = defineSetting({
	type: "checkbox",
	label: "Budget Card Styling",
	description: "Add a spending flow bar to the current month's budget card.",
	group: "Budget",
	icon: "networth",
	preview: BudgetCardStylingPreview,
	context: {
		key: "budget-card-styling",
		defaultValue: true,
	},
	css: () => CSS,
	init: async () => {
		await loadCurrency();

		const unwatch = watchDom(processCards);

		// Re-process when navigating back to the budget page
		const stopWatchingRoute = watchRoute(processCards);

		return () => {
			unwatch();
			stopWatchingRoute();
			cleanupCards();
		};
	},
});
