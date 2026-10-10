import { defineSetting } from "@features/types";
import BalancePillsPreview from "../previews/BalancePills.svelte";
import {
	BALANCE_CELL_RE,
	fetchCells,
	type CatCells,
} from "@features/readability/category-progress/cells";
import { watchBudgetTable } from "@lib/utilities/budget-cells";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";

const STATUS_ATTR = "data-abt-balance-status";
const TEXT_ATTR = "data-abt-balance-text";

type Status = "funded" | "underfunded" | "overspent";

function svgMask(paths: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const ICONS: Record<Status, string> = {
	funded: svgMask('<path d="M20 6 9 17l-5-5"/>'),
	underfunded: svgMask('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
	overspent: svgMask('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'),
};

const TONES: Record<Status, string> = {
	funded: "var(--color-noticeTextLight)",
	underfunded: "var(--color-warningText)",
	overspent: "var(--color-errorText)",
};

const CSS = (Object.keys(TONES) as Status[])
	.map(
		(status) => `
	[${STATUS_ATTR}="${status}"] {
		--abt-pill-tone: ${TONES[status]};
		--abt-pill-icon: ${ICONS[status]};
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
`);

// Same states as Actual's own goal colouring; categories without a goal keep its plain balance.
function statusFor(data: CatCells): Status | null {
	if (!data.hasGoal) {
		return null;
	}
	if (data.balance < 0) {
		return "overspent";
	}
	return data.goalShortfall > 0 ? "underfunded" : "funded";
}

function scan(): void {
	if (!matchesPage(Page.Budget)) {
		clearAll();
		return;
	}
	for (const span of document.querySelectorAll<HTMLElement>(
		'[data-testid="balance"] span[data-cellname]',
	)) {
		const match = span.getAttribute("data-cellname")?.match(BALANCE_CELL_RE);
		if (!match) {
			continue;
		}
		const [, sheet, catId] = match;
		const cellName = span.getAttribute("data-cellname");

		// A changed balance means a budget edit or new spending; skip the cache then.
		const text = span.textContent ?? "";
		const force = span.hasAttribute(TEXT_ATTR) && span.getAttribute(TEXT_ATTR) !== text;
		span.setAttribute(TEXT_ATTR, text);

		void fetchCells(sheet, catId, force).then((data) => {
			// React reuses these nodes across months; only paint if it's still this cell.
			if (!span.isConnected || span.getAttribute("data-cellname") !== cellName) {
				return;
			}
			const status = statusFor(data);
			if (status) {
				span.setAttribute(STATUS_ATTR, status);
			} else {
				span.removeAttribute(STATUS_ATTR);
			}
		});
	}
}

function clearAll(): void {
	for (const el of document.querySelectorAll(`[${STATUS_ATTR}], [${TEXT_ATTR}]`)) {
		el.removeAttribute(STATUS_ATTR);
		el.removeAttribute(TEXT_ATTR);
	}
}

export const balancePills = defineSetting({
	type: "checkbox",
	label: "Balance Status Pills",
	description: "Show goal balances as funded, underfunded or overspent pills.",
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
		const unwatchTable = watchBudgetTable(scan);
		const unwatchPage = watchDom(() => {
			if (!matchesPage(Page.Budget)) {
				clearAll();
			}
		});
		return () => {
			unwatchTable();
			unwatchPage();
			clearAll();
		};
	},
});
