import { defineSetting } from "@features/types";
import { watchDom } from "@lib/dom/dom-watcher";
import { GRID, GRID_ROW, MOBILE_BUDGET_HEADER } from "@lib/actual-dom";

// The budget's banners (uncategorized, overspent, over-budgeted) are a list above the table's
// header. Each is a card whose content row holds the message and one action button.
const BANNER_ATTR = "data-abt-m-banner";

/** Actual sets each banner's kind only as its background colour, so it's matched against the theme's. */
function kindOf(card: HTMLElement, probe: HTMLElement): string {
	const bg = getComputedStyle(card).backgroundColor;
	probe.style.background = "var(--color-errorBackground)";
	if (getComputedStyle(probe).backgroundColor === bg) {
		return "critical";
	}
	probe.style.background = "var(--color-warningBackground)";
	return getComputedStyle(probe).backgroundColor === bg ? "warning" : "info";
}

function markBanners() {
	const header = document.querySelector(MOBILE_BUDGET_HEADER);
	if (!header) {
		return;
	}
	// Lists above the table's header; the category groups are lists too, but below it.
	const lists = [...document.querySelectorAll(GRID)].filter(
		(grid) => header.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_PRECEDING,
	);
	let probe: HTMLElement | null = null;
	for (const button of lists.flatMap((list) => [
		...list.querySelectorAll<HTMLElement>(`${GRID_ROW} button`),
	])) {
		const card = button.parentElement?.parentElement?.parentElement;
		if (!card || card.hasAttribute(BANNER_ATTR)) {
			continue;
		}
		probe ??= document.body.appendChild(document.createElement("div"));
		card.setAttribute(BANNER_ATTR, kindOf(card, probe));
	}
	probe?.remove();
}

export const mobileBudgetBanners = defineSetting({
	type: "checkbox",
	label: "Budget banners",
	description: "Restyles the overspent and uncategorized banners as cards.",
	group: "Mobile",
	icon: "alert",
	platform: "mobile",
	context: {
		key: "mobile-budget-banners",
		defaultValue: false,
	},
	css: () => `
		[${BANNER_ATTR}] {
			position: relative;
			height: auto !important;
			min-height: 52px;
			margin: var(--abt-space-3) var(--abt-space-4) !important;
			padding: var(--abt-space-4) var(--abt-space-4) var(--abt-space-4) 52px !important;
			border: 1px solid var(--color-tableBorder) !important;
			border-radius: var(--abt-radius-lg) !important;
			background: var(--color-tableBackground) !important;
			box-shadow: none !important;
			font-size: var(--abt-text-lg);
			--abt-banner-tone: var(--color-noticeTextLight);
		}

		[${BANNER_ATTR}="critical"] {
			--abt-banner-tone: var(--color-errorText);
		}

		[${BANNER_ATTR}="warning"] {
			--abt-banner-tone: var(--color-warningText);
		}

		[${BANNER_ATTR}]::before {
			content: "!";
			position: absolute;
			top: 50%;
			left: var(--abt-space-4);
			width: 26px;
			height: 26px;
			margin-top: -13px;
			display: grid;
			place-items: center;
			border-radius: var(--abt-radius-pill);
			background: color-mix(in srgb, var(--abt-banner-tone) 18%, transparent);
			color: var(--abt-banner-tone);
			font-size: var(--abt-text-lg);
			font-weight: 700;
		}

		/* The over-budgeted banner's own arrow, which the icon replaces. */
		[${BANNER_ATTR}] svg {
			display: none;
		}

		[${BANNER_ATTR}] > div > div {
			gap: var(--abt-space-4);
		}

		[${BANNER_ATTR}] button {
			flex-shrink: 0;
			padding: 0 !important;
			border: 0 !important;
			background: none !important;
			color: var(--abt-accent) !important;
			font-size: var(--abt-text-lg) !important;
			font-weight: 600;
		}

		/* A chevron, set apart: the button is a flex box, so a leading space in content collapses. */
		[${BANNER_ATTR}] button::after {
			content: "›";
			margin-left: var(--abt-space-2);
			font-size: var(--abt-text-xl);
			font-weight: 400;
			line-height: 1;
			opacity: 0.7;
		}
	`,
	init: () => {
		const stop = watchDom(markBanners);
		return () => {
			stop();
			for (const el of document.querySelectorAll(`[${BANNER_ATTR}]`)) {
				el.removeAttribute(BANNER_ATTR);
			}
		};
	},
});
