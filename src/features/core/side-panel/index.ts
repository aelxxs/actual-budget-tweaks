import { applyGlobalCSS, createElement } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { clamp } from "@lib/utilities/math";
import { getValue, hasValue, setValue } from "@lib/utilities/store";
import { mountToPanelBody } from "@lib/utilities/svelte";
import {
	CONTENT_GRID,
	PANEL_CLOSE_EVENT,
	PANEL_DISMISS_EVENT,
	PANEL_OPEN_EVENT,
	PANEL_SET_TITLE_EVENT,
	SIDEBAR_ATTR,
	type OpenOptions,
} from "./api";
import SidePanelContent from "./Content.svelte";
import { panelState } from "./panel-state.svelte";

const SIDEBAR_CLOSING_CLASS = "abt-side-drawer-sidebar-closing";
const DEFAULT_SIDEBAR_WIDTH = 350;
const MIN_SIDEBAR_WIDTH = 0;
const MAX_SIDEBAR_WIDTH = 640;

function getSafeTitle(title: unknown, fallback: string = "") {
	if (typeof title !== "string") {
		return fallback;
	}

	const trimmed = title.trim();
	return trimmed.length ? trimmed : fallback;
}

function isDomNodeLike(value: unknown): value is Node {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as { nodeType?: unknown; nodeName?: unknown };
	return typeof candidate.nodeType === "number" && typeof candidate.nodeName === "string";
}

const GRID_ATTR = "data-abt-content-grid";

/**
 * Marked once found: CONTENT_GRID only matches once a page's content has rendered, and the
 * panel has to be in place before then, or the page lays out at full width and then reflows.
 */
function getBodyElement() {
	const marked = document.querySelector<HTMLElement>(`[${GRID_ATTR}]`);
	if (marked) return marked;
	const grid = document.querySelector<HTMLElement>(CONTENT_GRID);
	grid?.setAttribute(GRID_ATTR, "");
	return grid;
}

function removeSideDrawerLayout() {
	document.querySelector(`[${SIDEBAR_ATTR}]`)?.remove();
}

const STORAGE_KEY = "side-panel";
const WIDTH_KEY = "side-panel-width";
const PERSIST_KEY = "side-panel-persist";

/** Mirrors PERSIST_KEY so a page coming back can reopen its panel before it paints. */
let persistedRoute: string | null | undefined;

function setPersistedRoute(route: string | null): void {
	persistedRoute = route;
	setValue(PERSIST_KEY, route ? { route } : null);
}

const CSS = `
	@keyframes abt-side-drawer-enter {
		from { opacity: 0; transform: translateX(14px); }
		to { opacity: 1; transform: translateX(0); }
	}
	@keyframes abt-side-drawer-exit {
		from { opacity: 1; transform: translateX(0); }
		to { opacity: 0; transform: translateX(14px); }
	}
	[${GRID_ATTR}]:has([${SIDEBAR_ATTR}]) {
		display: grid;
		height: 100vh;
		grid-template-rows: auto 1fr;
		grid-template-columns: 1fr ${DEFAULT_SIDEBAR_WIDTH}px;
		grid-template-areas: "header header" "body sidebar";
	}
	[${GRID_ATTR}]:has([${SIDEBAR_ATTR}]) > div:nth-child(1) {
		grid-area: header;
	}
	[${GRID_ATTR}]:has([${SIDEBAR_ATTR}]) > div:nth-child(2) {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
		z-index: 1000;
	}
	[${GRID_ATTR}]:has([${SIDEBAR_ATTR}]) > div:nth-child(3) {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1000;
	}
	/* By identity, not position: a page that renders after the panel lands after it. */
	[${GRID_ATTR}]:has([${SIDEBAR_ATTR}]) > div:nth-child(n + 4):not([${SIDEBAR_ATTR}]) {
		grid-area: body;
		overflow-y: auto;
		min-height: 0;
	}
	[${GRID_ATTR}] > [${SIDEBAR_ATTR}] {
		grid-area: sidebar;
	}
	.abt-side-drawer-sidebar {
		position: relative;
		/* Over the content's sticky table headers (200), so the resize handle straddling the
		   border isn't clipped; under the page's banners and toasts (1000). */
		z-index: 300;
		display: flex;
		min-width: ${MIN_SIDEBAR_WIDTH}px;
		max-width: ${MAX_SIDEBAR_WIDTH}px;
		min-height: 0;
		/* Visible so the resize grip can straddle the border; the body scrolls itself. */
		overflow: visible;
		/* Derived, not --border: themes may omit tableBorder or set it to the page background. */
		border-left: 1px solid var(--abt-panel-border);
		animation: abt-side-drawer-enter 110ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.abt-side-drawer-sidebar.${SIDEBAR_CLOSING_CLASS} {
		pointer-events: none;
		animation: abt-side-drawer-exit 90ms cubic-bezier(0.4, 0, 1, 1) forwards;
	}
`;

export const sidePanel = {
	type: "core" as const,
	init: async () => {
		applyGlobalCSS(CSS, STORAGE_KEY);

		const storedWidth = await getValue(WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH);
		const storedPersist = await getValue<{ route: string } | null>(PERSIST_KEY, null);
		persistedRoute = storedPersist?.route ?? null;
		let widthStored = await hasValue(WIDTH_KEY);

		let isOpen = storedPersist?.route === location.pathname;
		// Whether the open panel is the persisted one: closing another (say the calendar's day
		// details) mustn't forget that Insights was left open on the budget page.
		let showingPersisted = isOpen;
		const forgetPersisted = () => {
			if (showingPersisted) setPersistedRoute(null);
			showingPersisted = false;
		};
		let animateNext = true;
		let requestedWidth = DEFAULT_SIDEBAR_WIDTH;
		let sidebarWidth = clamp(Math.round(storedWidth), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);

		const sync = () => {
			getBodyElement();
			if (!isOpen) {
				removeSideDrawerLayout();
				return;
			}

			const body = getBodyElement();
			if (!body) {
				removeSideDrawerLayout();
				return;
			}

			const existing = document.querySelector<HTMLElement>(`[${SIDEBAR_ATTR}]`);
			if (existing) {
				// React appends a remounted page after it; base.css finds the page as the 4th child.
				if (existing.parentElement === body && body.lastElementChild !== existing) {
					existing.style.animation = "none";
					body.appendChild(existing);
				}
				return;
			}

			const sidebar = createElement("div", { className: "abt-side-drawer-sidebar" });
			sidebar.setAttribute(SIDEBAR_ATTR, "true");
			if (!animateNext) sidebar.style.animation = "none";
			animateNext = true;
			sidebar.appendChild(
				mountToPanelBody(SidePanelContent, {
					onClose: () => {
						isOpen = false;
						forgetPersisted();
						sync();
					},
					initialWidth: sidebarWidth,
					defaultWidth: () => requestedWidth,
					onResize: (width: number) => {
						body.style.gridTemplateColumns = `1fr ${width}px`;
					},
					onResizeEnd: (width: number) => {
						sidebarWidth = width;
						widthStored = true;
						setValue(WIDTH_KEY, width);
					},
				}),
			);
			body.appendChild(sidebar);
			body.style.gridTemplateColumns = `1fr ${sidebarWidth}px`;
		};

		document.addEventListener(PANEL_OPEN_EVENT, (event) => {
			const detail: OpenOptions = (event as CustomEvent).detail ?? {};
			panelState.title = getSafeTitle(detail.title, panelState.title);
			panelState.bodyNode = isDomNodeLike(detail.bodyNode) ? detail.bodyNode : null;
			panelState.headerNode = isDomNodeLike(detail.headerNode) ? detail.headerNode : null;

			// Already mounted — panelState above already flowed into the live component, no teardown/remount needed.
			const alreadyOpen = isOpen && !!document.querySelector(`[${SIDEBAR_ATTR}]`);
			isOpen = true;

			showingPersisted = !!detail.persist;
			animateNext = detail.animate !== false;
			if (detail.persist) {
				setPersistedRoute(location.pathname);
			}
			if (typeof detail.width === "number") {
				requestedWidth = clamp(Math.round(detail.width), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
			}
			if (typeof detail.width === "number" && !widthStored) {
				sidebarWidth = clamp(Math.round(detail.width), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
			}

			if (!alreadyOpen) {
				removeSideDrawerLayout();
				sync();
			}
		});

		document.addEventListener(PANEL_CLOSE_EVENT, () => {
			isOpen = false;
			forgetPersisted();
			sync();
		});

		document.addEventListener(PANEL_DISMISS_EVENT, () => {
			isOpen = false;
			showingPersisted = false;
			panelState.bodyNode = null;
			panelState.headerNode = null;
			sync();
		});

		document.addEventListener("abt:navigate", async () => {
			const persisted = await getValue<{ route: string } | null>(PERSIST_KEY, null);
			if (persisted?.route === location.pathname) {
				if (!isOpen) {
					isOpen = true;
					sync();
				}
			} else {
				if (isOpen) {
					isOpen = false;
					sync();
				}
			}
		});

		document.addEventListener(PANEL_SET_TITLE_EVENT, (event) => {
			const { title } = (event as CustomEvent).detail ?? {};
			panelState.title = getSafeTitle(title, panelState.title);
		});

		const unwatch = watchDom(sync);

		return () => unwatch();
	},
};

/**
 * Whether the side panel was left open on this exact route across a reload —
 * i.e. what `sidePanel.init()` itself will restore. Consumers that want to
 * repopulate the panel on startup must check this instead of `sidepanel.isOpen()`:
 * that only reflects whether the (possibly still-empty) drawer shell has been
 * created, and this feature's own `init()` — the thing that creates it from
 * persisted state — runs concurrently with every other feature's `init()`
 * (see runtime.ts's `bootstrapSettings`), so there's no ordering guarantee
 * between the two. Reading the same persisted flag directly sidesteps that
 * race instead of polling its racy DOM side-effect.
 */
export async function wasPanelPersistedOpen(): Promise<boolean> {
	const persisted = await getValue<{ route: string } | null>(PERSIST_KEY, null);
	return persisted?.route === location.pathname;
}

/** wasPanelPersistedOpen without the wait; undefined until the side panel has loaded. */
export function isPanelPersistedOpen(): boolean | undefined {
	return persistedRoute === undefined ? undefined : persistedRoute === location.pathname;
}

export { sidepanel } from "./api";
export type { OpenOptions, SidePanelApi } from "./api";
