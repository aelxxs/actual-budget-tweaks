import { applyGlobalCSS, createElement } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { clamp } from "@lib/utilities/math";
import { getValue, hasValue, setValue } from "@lib/utilities/store";
import { mount, unmount } from "svelte";
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
// Set in JS: as `:has([drawer])` on the grid, every change in the page restyled the whole page.
const OPEN_ATTR = "data-abt-panel-open";

/**
 * Marked once found: CONTENT_GRID only matches once a page's content has rendered, and the
 * panel has to be in place before then, or the page lays out at full width and then reflows.
 */
function getBodyElement() {
	const marked = document.querySelector<HTMLElement>(`[${GRID_ATTR}]`);
	if (marked) {
		return marked;
	}
	const grid = document.querySelector<HTMLElement>(CONTENT_GRID);
	grid?.setAttribute(GRID_ATTR, "");
	return grid;
}

// A drawer React removed is detached, not destroyed: a live instance would keep pulling
// panelState's nodes into it, leaving the visible drawer blank.
let content: ReturnType<typeof mount> | null = null;
function destroyContent() {
	if (content) {
		unmount(content);
	}
	content = null;
}

function removeSideDrawerLayout() {
	destroyContent();
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
	[${GRID_ATTR}][${OPEN_ATTR}] {
		display: grid;
		height: 100vh;
		grid-template-rows: auto 1fr;
		grid-template-columns: 1fr ${DEFAULT_SIDEBAR_WIDTH}px;
		grid-template-areas: "header header" "body sidebar";
	}
	[${GRID_ATTR}][${OPEN_ATTR}] > div:nth-child(1) {
		grid-area: header;
	}
	[${GRID_ATTR}][${OPEN_ATTR}] > div:nth-child(2) {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
		z-index: 1000;
	}
	[${GRID_ATTR}][${OPEN_ATTR}] > div:nth-child(3) {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1000;
	}
	/* By identity, not position: a page that renders after the panel lands after it. */
	[${GRID_ATTR}][${OPEN_ATTR}] > div:nth-child(n + 4):not([${SIDEBAR_ATTR}]) {
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
			if (showingPersisted) {
				setPersistedRoute(null);
			}
			showingPersisted = false;
		};
		// Panels opened with `stack` keep the ones underneath, restored as each closes.
		type Entry = {
			key?: string;
			title: string;
			bodyNode: Node | null;
			headerNode: Node | null;
			persisted: boolean;
		};
		let under: Entry[] = [];
		let currentKey: string | undefined;
		const restoreUnder = (): boolean => {
			const prev = under.pop();
			if (!prev) {
				return false;
			}
			panelState.title = prev.title;
			panelState.bodyNode = prev.bodyNode;
			panelState.headerNode = prev.headerNode;
			showingPersisted = prev.persisted;
			currentKey = prev.key;
			return true;
		};
		let animateNext = true;
		let requestedWidth = DEFAULT_SIDEBAR_WIDTH;
		let sidebarWidth = clamp(Math.round(storedWidth), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);

		const markOpen = () => {
			const grid = document.querySelector(`[${GRID_ATTR}]`);
			grid?.toggleAttribute(OPEN_ATTR, !!grid.querySelector(`:scope > [${SIDEBAR_ATTR}]`));
		};

		const sync = () => {
			place();
			markOpen();
		};

		const place = () => {
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
			if (!animateNext) {
				sidebar.style.animation = "none";
			}
			animateNext = true;
			destroyContent();
			const container = createElement("div", {
				style: {
					display: "flex",
					flex: "1",
					flexDirection: "column",
					height: "100%",
					minHeight: "0px",
					overflow: "hidden",
				},
			});
			content = mount(SidePanelContent, {
				target: container,
				props: {
					stacked: () => under.length > 0,
					onClose: () => {
						if (restoreUnder()) {
							document.querySelector(`[${SIDEBAR_ATTR}]`)?.classList.remove(SIDEBAR_CLOSING_CLASS);
							return;
						}
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
				},
			});
			sidebar.appendChild(container);
			body.appendChild(sidebar);
			body.style.gridTemplateColumns = `1fr ${sidebarWidth}px`;
		};

		document.addEventListener(PANEL_OPEN_EVENT, (event) => {
			const detail: OpenOptions = (event as CustomEvent).detail ?? {};
			// Already mounted — panelState below flows into the live component, no teardown/remount needed.
			const alreadyOpen = isOpen && !!document.querySelector(`[${SIDEBAR_ATTR}]`);
			if (!detail.stack) {
				under = [];
			} else if (alreadyOpen && panelState.bodyNode && (!detail.key || detail.key !== currentKey)) {
				under.push({
					key: currentKey,
					title: panelState.title,
					bodyNode: panelState.bodyNode,
					headerNode: panelState.headerNode,
					persisted: showingPersisted,
				});
			}
			currentKey = detail.key;

			panelState.title = getSafeTitle(detail.title, panelState.title);
			panelState.bodyNode = isDomNodeLike(detail.bodyNode) ? detail.bodyNode : null;
			panelState.headerNode = isDomNodeLike(detail.headerNode) ? detail.headerNode : null;
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
			if (restoreUnder()) {
				return;
			}
			isOpen = false;
			forgetPersisted();
			sync();
		});

		document.addEventListener(PANEL_DISMISS_EVENT, () => {
			under = [];
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
				// Put back the bottom panel, so coming back to its page shows it rather than a stacked one.
				under = under.slice(0, 1);
				restoreUnder();
				if (isOpen) {
					isOpen = false;
					sync();
				}
			}
		});

		document.addEventListener(PANEL_SET_TITLE_EVENT, (event) => {
			const { title } = (event as CustomEvent).detail ?? {};
			// Only base panels (Insights, reconcile) set titles; one stacked on top keeps its own.
			if (under.length) {
				under[0].title = getSafeTitle(title, under[0].title);
			} else {
				panelState.title = getSafeTitle(title, panelState.title);
			}
		});

		const unwatch = watchDom(sync);

		return () => {
			unwatch();
			document.querySelector(`[${GRID_ATTR}]`)?.removeAttribute(OPEN_ATTR);
		};
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
