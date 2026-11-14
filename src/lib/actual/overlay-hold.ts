import { CONTENT_GRID, MONTH_ICON } from "@lib/actual-dom";
import { lastShown, rememberShown } from "@lib/last-shown";
import { addressedOverlay } from "./pages";

/** Marks the container of a page ABT draws over Actual's (the calendar, the graph). */
export const OVERLAY_ATTR = "data-abt-overlay-page";

const HOLD_ID = "abt-overlay-hold";
// Kept in the site's own storage, so only Actual's site, where an ABT page was left open, holds.
const OPEN_KEY = "overlay-open";
// Found without ABT's markers too: Actual draws its page before ABT has started to mark it.
// The `:has` in CONTENT_GRID only applies while held, for a few seconds after a load.
const UNDER = `:not([${OVERLAY_ATTR}])`;
// The month-count selector sits in the titlebar, outside the page.
const PAGE = `${CONTENT_GRID} > div:nth-child(4) > ${UNDER}, [data-abt-page] > ${UNDER}, ${MONTH_ICON}`;
// Longest the page stays hidden, so an ABT page that fails to open can't leave it blank.
const HOLD_TIMEOUT = 5000;

/**
 * Hides Actual's page while the ABT page its address names reopens over it; otherwise the page
 * underneath shows first.
 */
export function holdPage(): void {
	if (document.getElementById(HOLD_ID) || !addressedOverlay()) {
		return;
	}
	const style = document.createElement("style");
	style.id = HOLD_ID;
	style.textContent = `${PAGE} { visibility: hidden !important; }`;
	// documentElement: at document_start there may be no head yet.
	document.documentElement.append(style);
	setTimeout(releasePage, HOLD_TIMEOUT);
}

/** The hold on a reload, before Actual renders; only where an ABT page was left open. */
export function holdPageOnLoad(): void {
	if (lastShown(OPEN_KEY, false)) {
		holdPage();
	}
}

/** Whether an ABT page is open, for the next load to know before anything renders. */
export function rememberOverlayOpen(open: boolean): void {
	rememberShown(OPEN_KEY, open);
}

export function releasePage(): void {
	document.getElementById(HOLD_ID)?.remove();
}
