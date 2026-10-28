import { defineSetting } from "@features/types";
import { loadData, markStale } from "@features/workflows/category-template-insights/data";
import { rowCategoryId, watchBudgetTable } from "@lib/utilities/budget-cells";
import { loadCurrency } from "@lib/utilities/currency";
import { Page, matchesPage } from "@lib/utilities/pages";
import { positionPopover } from "@lib/utilities/popover";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import ScheduleCard from "./ScheduleCard.svelte";
import { CATEGORY_SPENT, ROW } from "@lib/actual-dom";

// The icon's wrapper, which carries Actual's title tooltip; the amount beside it is a span.
const ICON = `${CATEGORY_SPENT} > div`;
const TITLE_ATTR = "data-abt-schedule-title";
const HOVER_DELAY_MS = 200;

// Actual spreads the icon and amount apart, which leaves the icon next to the budgeted amount.
// A fixed-width amount keeps the icons in one column instead of following each number's width.
const CSS = `
	${CATEGORY_SPENT} {
		justify-content: flex-end !important;
		gap: var(--abt-space-3) !important;
	}
	${CATEGORY_SPENT} > span {
		min-width: 10ch;
		text-align: right;
	}
	.abt-schedule-card-wrap {
		position: fixed;
		z-index: 10000;
	}
`;

let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let currentIcon: HTMLElement | null = null;
let card: Mounted | null = null;

function onMouseOver(e: MouseEvent) {
	const icon = (e.target as Element | null)?.closest?.<HTMLElement>(ICON);
	if (!icon || icon === currentIcon || !matchesPage(Page.Budget)) {
		return;
	}
	dismiss();
	currentIcon = icon;
	hoverTimer = setTimeout(() => void open(icon), HOVER_DELAY_MS);
}

function onMouseOut(e: MouseEvent) {
	if (currentIcon && !currentIcon.contains(e.relatedTarget as Node | null)) {
		dismiss();
	}
}

async function open(icon: HTMLElement) {
	const row = icon.closest(ROW);
	const id = row && rowCategoryId(row);
	const entry = id ? (await loadData())?.get(id) : undefined;
	// Without ABT's data for it, Actual's own tooltip stays.
	if (currentIcon !== icon || !icon.isConnected || !entry?.linkedSchedules.length) {
		return;
	}
	const title = icon.getAttribute("title");
	if (title != null) {
		icon.setAttribute(TITLE_ATTR, title);
		icon.removeAttribute("title");
	}
	card = mountToNodeWithReturn(ScheduleCard, {
		links: entry.linkedSchedules,
		onClose: dismiss,
	});
	card.node.className = "abt-popover abt-schedule-card-wrap";
	document.body.appendChild(card.node);
	positionPopover(card.node, icon, { gap: 6 });
}

function dismiss() {
	if (hoverTimer) {
		clearTimeout(hoverTimer);
	}
	hoverTimer = null;
	currentIcon = null;
	card?.destroy();
	card = null;
}

function restoreTitles() {
	for (const el of document.querySelectorAll(`[${TITLE_ATTR}]`)) {
		el.setAttribute("title", el.getAttribute(TITLE_ATTR) ?? "");
		el.removeAttribute(TITLE_ATTR);
	}
}

export const scheduleIconDetails = defineSetting({
	type: "checkbox",
	label: "Schedule Icon Details",
	description:
		"Line up the schedule icons beside the spent amounts, with a hover card for each schedule.",
	group: "Budget",
	icon: "calendar",
	context: {
		key: "schedule-icon-details",
		defaultValue: false,
	},
	css: () => CSS,
	init: async () => {
		await loadCurrency();
		// A payment landing or a template edit changes what the card shows; read again on next hover.
		const unwatchTable = watchBudgetTable(() => markStale());
		document.addEventListener("mouseover", onMouseOver);
		document.addEventListener("mouseout", onMouseOut);
		document.addEventListener("mousedown", dismiss, true);
		return () => {
			unwatchTable();
			document.removeEventListener("mouseover", onMouseOver);
			document.removeEventListener("mouseout", onMouseOut);
			document.removeEventListener("mousedown", dismiss, true);
			dismiss();
			restoreTitles();
		};
	},
});
