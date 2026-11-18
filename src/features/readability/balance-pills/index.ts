import {
	BALANCE_CELL_RE,
	fetchCells,
	markCellsStale,
	type CatCells,
} from "@features/readability/category-progress/cells";
import { defineSetting } from "@features/types";
import { BALANCE_CELL, CELL, GOAL_RING } from "@lib/actual-dom";
import { watchBudgetTable, type BudgetTableChange } from "@lib/actual/budget-cells";
import { Page, matchesPage } from "@lib/actual/pages";
import { watchDom } from "@lib/dom/dom-watcher";
import { THEME_APPLIED_EVENT } from "@lib/theme-events";
import { pageMode } from "@features/theme/theme-apply";
import BalancePillsPreview from "../previews/BalancePills.svelte";

const STATUS_ATTR = "data-abt-balance-status";
// On the balance's button instead of its amount when Actual's goal ring is there, so the pill holds the ring.
export const RING_ATTR = "data-abt-balance-ring";
const LIGHT_ATTR = "data-abt-balance-light";

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
	available: "color-mix(in srgb, var(--color-pageTextSubdued) 60%, var(--color-tableText))",
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
		gap: var(--abt-space-2);
		padding: 1px 8px 1px 6px;
		border-radius: var(--abt-radius-pill);
		--abt-pill-bg: color-mix(in srgb, var(--abt-pill-tone) 16%, transparent);
		background: var(--abt-pill-bg);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--abt-pill-tone) 4%, transparent);
		color: var(--abt-pill-tone) !important;
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
		padding-inline: var(--abt-space-3);
		--abt-pill-bg: var(--abt-ink-3);
		box-shadow: none;
	}
	[${STATUS_ATTR}="available"]::before {
		display: none;
	}

	[${RING_ATTR}] {
		width: auto !important;
		margin-left: auto;
		padding: 1px 8px 1px 6px !important;
		background: var(--abt-pill-bg) !important;
	}
	[${RING_ATTR}]::before {
		display: none;
	}
	[${RING_ATTR}] > svg {
		margin-right: 0 !important;
	}
	[${RING_ATTR}] ${CELL} {
		color: inherit !important;
	}

	/* Light pages: an opaque pastel fill, and text pulled toward the table ink to stay readable. */
	[${LIGHT_ATTR}] [${STATUS_ATTR}]:not([${STATUS_ATTR}="available"]) {
		--abt-pill-bg: oklch(from var(--abt-pill-tone) 0.93 calc(c * 0.35) h);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--abt-pill-tone) 7%, transparent);
		color: color-mix(in srgb, var(--abt-pill-tone), var(--color-tableText) 30%) !important;
	}
	/* Yellow turns beige when this pale, so it keeps more of its colour. */
	[${LIGHT_ATTR}] [${STATUS_ATTR}="underfunded"] {
		--abt-pill-bg: oklch(from var(--abt-pill-tone) 0.93 calc(c * 0.5) h);
	}
`);

// Goal states match Actual's own goal colouring, except a zero balance on a met goal stays plain:
// it reads as nothing left, not as a tick. Without a goal, only overspent carries a status.
function statusFor(data: CatCells): Status {
	if (data.balance < 0) {
		return "overspent";
	}
	if (data.hasGoal && data.goalShortfall > 0) {
		return "underfunded";
	}
	if (data.hasGoal && data.balance > 0) {
		return "funded";
	}
	return "available";
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
			const button = span.closest("button");
			const ring = status === "underfunded" && !!button?.querySelector(`:scope > ${GOAL_RING}`);
			setStatus(span, ring ? null : status);
			if (button) {
				setStatus(button, ring ? status : null);
				if (button.hasAttribute(RING_ATTR) !== ring) {
					button.toggleAttribute(RING_ATTR, ring);
				}
			}
		});
	}
}

function setStatus(el: Element, status: Status | null): void {
	if (status && el.getAttribute(STATUS_ATTR) !== status) {
		el.setAttribute(STATUS_ATTR, status);
	} else if (!status && el.hasAttribute(STATUS_ATTR)) {
		el.removeAttribute(STATUS_ATTR);
	}
}

function clearAll(): void {
	for (const el of document.querySelectorAll(`[${STATUS_ATTR}], [${RING_ATTR}]`)) {
		el.removeAttribute(STATUS_ATTR);
		el.removeAttribute(RING_ATTR);
	}
}

export const balancePills = defineSetting({
	type: "checkbox",
	label: "Balance status pills",
	description: "Adds an icon to each balance's status, so it doesn't rely on color alone.",
	group: "Budget",
	icon: "checkCircle",
	preview: BalancePillsPreview,
	context: {
		key: "balance-status-pills",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		const root = document.documentElement;
		const updateMode = () => root.toggleAttribute(LIGHT_ATTR, pageMode() === "light");
		updateMode();
		document.addEventListener(THEME_APPLIED_EVENT, updateMode);
		// Balances only change inside the budget table; leaving the page clears the marks.
		const unwatchTable = watchBudgetTable(onTableChange);
		const unwatchPage = watchDom(() => {
			if (!matchesPage(Page.Budget)) {
				clearAll();
			}
		});
		return () => {
			document.removeEventListener(THEME_APPLIED_EVENT, updateMode);
			root.removeAttribute(LIGHT_ATTR);
			unwatchTable();
			unwatchPage();
			cancelAnimationFrame(scanFrame);
			scanFrame = 0;
			clearAll();
		};
	},
});
