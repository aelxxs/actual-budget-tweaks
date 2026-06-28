import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { loadCurrency } from "@lib/utilities/currency";
import { getValue, setValue } from "@lib/utilities/store";
import { mountToNode } from "@lib/utilities/svelte";
import FlowBar from "./FlowBar.svelte";

const CSS = `
	[data-testid="budget-summary"] {
		border-radius: var(--border-radius-lg, 8px);
		overflow: hidden;
		transition: box-shadow 0.15s, border-color 0.15s;
	}

	[data-testid="budget-summary"]:hover {
		box-shadow: 0 2px 12px color-mix(in srgb, var(--color-pageText) 8%, transparent);
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
		font-size: 11px !important;
		padding-left: 16px;
	}

	.abt-to-budget-value {
		text-align: center;
	}
`;

export const budgetCardStyling = defineSetting({
	type: "checkbox",
	label: "Budget Card Styling",
	context: {
		key: "budget-card-styling",
		defaultValue: true,
		_observer: null as MutationObserver | null,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled) {
			await loadCurrency();
			applyGlobalCSS(CSS, ctx.key);
			processCards();
			startObserver(ctx);
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (value) {
			applyGlobalCSS(CSS, ctx.key);
			processCards();
			startObserver(ctx);
		} else {
			applyGlobalCSS("", ctx.key);
			cleanup();
			ctx._observer?.disconnect();
		}
	},
});

function getCurrentYearMonth(): string {
	const now = new Date();
	return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseNum(text: string | null | undefined): number {
	if (!text) return 0;
	return parseFloat(text.replace(/[^0-9.\-−]/g, "").replace("−", "-")) || 0;
}

function processCards() {
	const ym = getCurrentYearMonth();

	for (const card of document.querySelectorAll<HTMLElement>('[data-testid="budget-summary"]')) {
		card.classList.toggle("abt-current-month", !!card.querySelector(`[data-cellname*="budget${ym}"]`));

		// Style the "To Budget:" label
		const toBudgetCell = card.querySelector<HTMLElement>('[data-cellname*="object Object"]');
		if (toBudgetCell) {
			const toBudgetSection = toBudgetCell.closest<HTMLElement>('[data-testid="budget-summary"] > div');
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

		const availableEl = card.querySelector<HTMLElement>('[data-cellname*="!available-funds"]');
		if (!availableEl) {
			card.querySelector(".abt-flow-mount")?.remove();
			card.querySelector(".abt-flow-hidden")?.classList.remove("abt-flow-hidden");
			continue;
		}

		const available = parseNum(availableEl.textContent);
		const overspent = Math.abs(
			parseNum(card.querySelector<HTMLElement>('[data-cellname*="!last-month-overspent"]')?.textContent),
		);
		const budgeted = Math.abs(
			parseNum(card.querySelector<HTMLElement>('[data-cellname*="!total-budgeted"]')?.textContent),
		);
		const forNext = Math.abs(
			parseNum(card.querySelector<HTMLElement>('[data-cellname*="!buffered-selected"]')?.textContent),
		);

		const fp = `${available}|${budgeted}|${overspent}|${forNext}`;
		const existing = card.querySelector<HTMLElement>(".abt-flow-mount");
		if (existing?.dataset.fp === fp) continue;

		existing?.remove();

		const breakdown = availableEl.closest<HTMLElement>('[data-testid="budget-summary"] > div');
		if (!breakdown) continue;

		breakdown.classList.add("abt-flow-hidden");

		const wrapper = mountToNode(FlowBar, { available, budgeted, overspent, forNext });
		wrapper.className = "abt-flow-mount";
		wrapper.style.display = "block";
		wrapper.dataset.fp = fp;
		breakdown.after(wrapper);
	}
}

function cleanup() {
	for (const card of document.querySelectorAll<HTMLElement>('[data-testid="budget-summary"]')) {
		card.classList.remove("abt-current-month");
		card.querySelector(".abt-flow-mount")?.remove();
		card.querySelector(".abt-flow-hidden")?.classList.remove("abt-flow-hidden");
	}
}

function startObserver(ctx: { _observer: MutationObserver | null }) {
	ctx._observer?.disconnect();
	let scheduled = false;
	const observer = new MutationObserver(() => {
		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(() => {
				processCards();
				scheduled = false;
			});
		}
	});
	ctx._observer = observer;
	observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
