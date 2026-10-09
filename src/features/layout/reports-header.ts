import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { matchesPage, Page } from "@lib/utilities/pages";

/*
 * The Reports page's title and dashboard buttons, held at the top while the widgets scroll under
 * them, with the border and height of ABT's other page headers. The page wrapper's top padding
 * moves into the header, so the header can stick flush under Actual's top bar.
 */
const REPORTS = '[data-testid="reports-page"]';
// Not the spending calendar, which mounts over this page as another child of it.
const PAGE = `${REPORTS} > div:not([data-abt-calendar])`;
const HEADER = `${PAGE} > div:first-of-type`;
// Actual's "Reports:" ahead of the dashboard name, its own element.
const TITLE = `${HEADER} > div:first-of-type`;
const LABEL = `${TITLE} > div:first-of-type`;
// The top bar scrolls with the page's container, so the header sticks below it, at this offset.
const TOP_VAR = "--abt-reports-header-top";

function measureTop() {
	if (!matchesPage(Page.Reports)) return;
	const reports = document.querySelector<HTMLElement>(REPORTS);
	const grid = reports?.closest<HTMLElement>("[data-abt-content-grid]");
	if (!reports || !grid) return;
	// Unrounded and re-read as the page settles: Firefox left a sliver of the widgets showing above a rounded or early value.
	const top =
		reports.getBoundingClientRect().top - grid.getBoundingClientRect().top + grid.scrollTop;
	const value = `${top}px`;
	if (reports.style.getPropertyValue(TOP_VAR) !== value) reports.style.setProperty(TOP_VAR, value);
}

export const reportsHeader = defineSetting({
	type: "checkbox",
	label: "Modern Reports Header",
	description:
		"Keep the Reports title and dashboard buttons in view while scrolling, titled as a quiet breadcrumb.",
	group: "Reports",
	icon: "layout",
	context: {
		key: "reports-header",
		defaultValue: true,
	},
	css: () => `
		/* Grows to its widgets, which otherwise overflow it; the header only sticks within it. */
		${PAGE} {
			flex-shrink: 0 !important;
			min-height: max-content !important;
			padding-top: 0 !important;
		}

		${HEADER} {
			position: sticky;
			top: var(${TOP_VAR}, 0);
			z-index: 10;
			box-sizing: border-box;
			min-height: var(--abt-panel-header-height);
			margin-bottom: var(--abt-space-5);
			padding-block: var(--abt-space-3);
			align-items: center;
			border-bottom: 1px solid var(--abt-panel-border);
			background: var(--color-pageBackground);
			margin-right: 0px;
			padding-right: 20px;
		}

		/*
		 * "Reports / Main" in place of "Reports: Main". The label's own text stays, invisible, to keep
		 * Actual's size and spacing; "Reports" is drawn over it, muted, and a slash replaces the colon.
		 */
		/* A step down from Actual's page title, nearer ABT's other headers. */
		${TITLE} > div {
			font-size: 20px !important; /* raw: no type token this large */
		}

		${LABEL} {
			position: relative;
			flex-direction: row !important;
			color: transparent !important;
		}

		${LABEL}::before {
			content: "Reports";
			position: absolute;
			left: 0;
			color: var(--color-pageTextSubdued);
		}

		${LABEL}::after {
			content: "/";
			margin: 0 0.25em 0 0.05em;
			color: var(--color-pageTextSubdued);
			font-weight: 300;
			opacity: 0.6;
		}
	`,
	init: () => {
		measureTop();
		const stop = watchDom(measureTop);
		return () => {
			stop();
			document.querySelector<HTMLElement>(REPORTS)?.style.removeProperty(TOP_VAR);
		};
	},
});
