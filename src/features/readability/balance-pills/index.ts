import { defineSetting } from "@features/types";
import BalancePillsPreview from "../previews/BalancePills.svelte";
import {
	BALANCE_CELL_RE,
	fetchCells,
	markCellsStale,
	type CatCells,
} from "@features/readability/category-progress/cells";
import { type BudgetTableChange, watchBudgetTable } from "@lib/utilities/budget-cells";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { BALANCE_CELL, CELL } from "@lib/actual-dom";

const STATUS_ATTR = "data-abt-balance-status";

type Status = "funded" | "underfunded" | "overspent" | "available";
// Goal statuses carry an icon; a plain positive balance doesn't.
type GoalStatus = Exclude<Status, "available">;

function svgMask(paths: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const ICONS: Record<GoalStatus, string> = {
	funded: svgMask('<path d="M20 6 9 17l-5-5"/>'),
	underfunded: svgMask('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
	overspent: svgMask('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'),
};

const TONES: Record<Status, string> = {
	funded: "var(--color-noticeTextLight)",
	underfunded: "var(--color-warningText)",
	overspent: "var(--color-errorText)",
	available: "var(--color-pageTextSubdued)",
};

const CSS = (Object.keys(TONES) as Status[])
	.map(
		(status) => `
	[${STATUS_ATTR}="${status}"] {
		--abt-pill-tone: ${TONES[status]};${
			status === "available"
				? ""
				: `
		--abt-pill-icon: ${ICONS[status]};`
		}
	}`,
	)
	.join("").concat(`
	[${STATUS_ATTR}] {
		display: inline-flex !important;
		align-items: center;
		gap: 4px;
		padding: 1px 8px 1px 6px;
		border-radius: var(--abt-radius-pill);
		background: color-mix(in srgb, var(--abt-pill-tone) 18%, transparent);
		color: color-mix(in srgb, var(--abt-pill-tone) 80%, var(--color-pageText)) !important;
		font-variant-numeric: tabular-nums;
		line-height: 1.5;
	}
	[${STATUS_ATTR}]::before {
		content: "";
		flex-shrink: 0;
		width: 12px;
		height: 12px;
		background: currentColor;
		-webkit-mask: var(--abt-pill-icon) center / contain no-repeat;
		mask: var(--abt-pill-icon) center / contain no-repeat;
	}
	[${STATUS_ATTR}="available"] {
		padding-inline: 8px;
		color: var(--color-tableText) !important;
	}
	[${STATUS_ATTR}="available"]::before {
		display: none;
	}
`);

// Goal states match Actual's own goal colouring. Without a goal, overspent still shows, and a
// positive balance gets a plain pill; zero stays bare, so unused categories stay quiet.
function statusFor(data: CatCells): Status | null {
	if (data.balance < 0) {
		return "overspent";
	}
	if (data.hasGoal) {
		return data.goalShortfall > 0 ? "underfunded" : "funded";
	}
	return data.balance > 0 ? "available" : null;
}

// One scan a frame, reading again only the categories whose cells changed (see category-progress).
let scanFrame = 0;

function onTableChange(change: BudgetTableChange): void {
	markCellsStale(change.changedCells);
	if (!scanFrame) {
		scanFrame = requestAnimationFrame(() => {
			scanFrame = 0;
			scan();
		});
	}
}

function scan(): void {
	if (!matchesPage(Page.Budget)) {
		clearAll();
		return;
	}
	for (const span of document.querySelectorAll<HTMLElement>(`${BALANCE_CELL} span${CELL}`)) {
		const match = span.getAttribute("data-cellname")?.match(BALANCE_CELL_RE);
		if (!match) {
			continue;
		}
		const [, sheet, catId] = match;
		const cellName = span.getAttribute("data-cellname");

		void fetchCells(sheet, catId).then((data) => {
			// React reuses these nodes across months; only paint if it's still this cell.
			if (!span.isConnected || span.getAttribute("data-cellname") !== cellName) {
				return;
			}
			const status = statusFor(data);
			if (status && span.getAttribute(STATUS_ATTR) !== status) {
				span.setAttribute(STATUS_ATTR, status);
			} else if (!status && span.hasAttribute(STATUS_ATTR)) {
				span.removeAttribute(STATUS_ATTR);
			}
		});
	}
}

function clearAll(): void {
	for (const el of document.querySelectorAll(`[${STATUS_ATTR}]`)) {
		el.removeAttribute(STATUS_ATTR);
	}
}

export const balancePills = defineSetting({
	type: "checkbox",
	label: "Balance Status Pills",
	description:
		"Show balances as pills: overspent, or funded and underfunded for categories with templates.",
	group: "Budget",
	icon: "gauge",
	preview: BalancePillsPreview,
	context: {
		key: "balance-status-pills",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		// Balances only change inside the budget table; leaving the page clears the marks.
		const unwatchTable = watchBudgetTable(onTableChange);
		const unwatchPage = watchDom(() => {
			if (!matchesPage(Page.Budget)) {
				clearAll();
			}
		});
		return () => {
			unwatchTable();
			unwatchPage();
			cancelAnimationFrame(scanFrame);
			scanFrame = 0;
			clearAll();
		};
	},
});
