import { applyGlobalCSS, createElement } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { clamp } from "@lib/utilities/math";
import { getValue, setValue } from "@lib/utilities/store";
import { mount, unmount } from "svelte";
import { CONTENT_GRID } from "@lib/actual-dom";
import {
	PANEL_CLOSE_EVENT,
	PANEL_DISMISS_EVENT,
	PANEL_OPEN_EVENT,
	PANEL_SET_TITLE_EVENT,
	PANEL_TOP_EVENT,
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

// The drawer's one Svelte instance, unmounted only when the drawer closes.
let content: ReturnType<typeof mount> | null = null;
function destroyContent() {
	if (content) {
		unmount(content);
	}
	content = null;
}

const STORAGE_KEY = "side-panel";
const WIDTH_KEY = "side-panel-width";
const PERSIST_KEY = "side-panel-persist";

// With the hash: an overlay page (the calendar) shares its path with the page under it.
const here = () => location.pathname + location.hash;

/** Mirrors PERSIST_KEY so a page coming back can reopen its panel before it paints. */
let persistedRoute: string | null | undefined;
/** Which panel the persisted route belongs to, so closing it by key forgets it even when hidden. */
let persistedKey: string | null = null;

function setPersistedRoute(route: string | null, key: string | null = null): void {
	persistedRoute = route;
	persistedKey = route ? key : null;
	setValue(PERSIST_KEY, route ? { route, key } : null);
}

const CSS = `
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
	}
	.abt-side-drawer-sidebar.${SIDEBAR_CLOSING_CLASS} {
		pointer-events: none;
		animation: abt-side-drawer-exit 90ms cubic-bezier(0.4, 0, 1, 1) forwards;
	}
`;

// Page scope compares paths only: an overlay (the calendar) adds a hash but is the same page.
const pagePath = () => location.pathname;

type Entry = {
	key?: string;
	title: string;
	bodyNode: Node | null;
	headerNode: Node | null;
	persisted: boolean;
	scope: "page" | "app";
	/** The page it opened on; a page panel closes once that page is left. */
	path: string;
};

export const sidePanel = {
	type: "core" as const,
	init: async () => {
		applyGlobalCSS(CSS, STORAGE_KEY);

		const storedWidth = await getValue(WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH);
		const storedPersist = await getValue<{ route: string; key?: string | null } | null>(
			PERSIST_KEY,
			null,
		);
		persistedRoute = storedPersist?.route ?? null;
		persistedKey = storedPersist?.key ?? null;

		/** Open panels, bottom first; the last one shows. */
		let stack: Entry[] = [];
		// Holds the drawer open, empty, on a page whose persisted panel is on its way, so the page
		// doesn't lay out full width and then reflow when the panel's feature fills it.
		let reserved = persistedRoute === here();
		let lastPath = pagePath();

		let sidebarWidth = clamp(Math.round(storedWidth), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);

		const isOpen = () => stack.length > 0 || reserved;

		const forget = (entry: Entry | undefined) => {
			if (entry?.persisted) {
				setPersistedRoute(null);
			}
		};

		/** Points panelState at the top entry; the drawer itself follows in sync(). */
		let topKey: string | null = null;
		const show = () => {
			const top = stack.at(-1);
			const key = top?.key ?? null;
			if (key !== topKey) {
				topKey = key;
				document.dispatchEvent(new CustomEvent(PANEL_TOP_EVENT, { detail: key }));
			}
			panelState.title = top?.title ?? panelState.title;
			panelState.bodyNode = top?.bodyNode ?? null;
			panelState.headerNode = top?.headerNode ?? null;
			panelState.bodies = stack
				.filter((e) => e.bodyNode)
				.map((e) => ({ key: e.key, node: e.bodyNode as Node }));
		};

		const markOpen = () => {
			const grid = document.querySelector(`[${GRID_ATTR}]`);
			grid?.toggleAttribute(OPEN_ATTR, !!grid.querySelector(`:scope > [${SIDEBAR_ATTR}]`));
		};

		/** A new page: its own page panels and every app panel stay; the rest close. */
		const onPageChange = () => {
			const path = pagePath();
			if (path === lastPath) {
				return;
			}
			lastPath = path;
			const kept = stack.filter((e) => e.scope === "app" || e.path === path);
			if (kept.length !== stack.length) {
				stack = kept;
				show();
			}
			reserved = persistedRoute === here() && !stack.some((e) => e.persisted);
		};

		const sync = () => {
			onPageChange();
			if (panelState.open !== isOpen()) {
				panelState.open = isOpen();
			}
			place();
			markOpen();
		};

		// Kept across React rebuilding the page's grid: moved onto the new grid in the same frame
		// rather than rebuilt, so navigating doesn't blank or remount what's open.
		let sidebar: HTMLElement | null = null;

		const removeDrawer = () => {
			destroyContent();
			sidebar?.remove();
			sidebar = null;
		};

		const place = () => {
			// Marks the page grid even with nothing open: base.css lays every page out from it.
			getBodyElement();
			if (!isOpen()) {
				removeDrawer();
				return;
			}
			// Between pages the grid can be missing for a moment; the drawer waits detached.
			const body = getBodyElement();
			if (!body) {
				return;
			}

			if (sidebar) {
				// React appends a remounted page after it; base.css finds the page as the 4th child.
				if (sidebar.parentElement !== body || body.lastElementChild !== sidebar) {
					sidebar.style.animation = "none";
					body.appendChild(sidebar);
					body.style.gridTemplateColumns = `1fr ${sidebarWidth}px`;
				}
				return;
			}

			sidebar = createElement("div", { className: "abt-side-drawer-sidebar" });
			sidebar.setAttribute(SIDEBAR_ATTR, "true");
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
					stacked: () => stack.length > 1,
					onClose: () => {
						forget(stack.pop());
						reserved = false;
						sidebar?.classList.remove(SIDEBAR_CLOSING_CLASS);
						show();
						sync();
					},
					initialWidth: sidebarWidth,
					defaultWidth: () => DEFAULT_SIDEBAR_WIDTH,
					onResize: (width: number) => {
						body.style.gridTemplateColumns = `1fr ${width}px`;
					},
					onResizeEnd: (width: number) => {
						sidebarWidth = width;
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
			const entry: Entry = {
				key: detail.key,
				title: getSafeTitle(detail.title, panelState.title),
				bodyNode: isDomNodeLike(detail.bodyNode) ? detail.bodyNode : null,
				headerNode: isDomNodeLike(detail.headerNode) ? detail.headerNode : null,
				persisted: !!detail.persist,
				scope: detail.scope ?? "page",
				path: pagePath(),
			};
			// Without `stack`, it replaces the page's panels; app panels stay open either way.
			if (!detail.stack) {
				stack = stack.filter((e) => e.scope === "app");
			}
			// The same panel opened again replaces itself rather than stacking a second copy.
			stack = stack.filter((e) => !entry.key || e.key !== entry.key);
			// A persisted panel coming back with its page goes under whatever app panel is open.
			if (reserved && entry.persisted) {
				stack.unshift(entry);
			} else {
				stack.push(entry);
			}
			reserved = false;

			if (detail.persist) {
				setPersistedRoute(here(), detail.key ?? null);
			}
			show();
			sync();
		});

		document.addEventListener(PANEL_CLOSE_EVENT, (event) => {
			const key = (event as CustomEvent<{ key?: string } | null>).detail?.key;
			const index = key ? stack.findIndex((e) => e.key === key) : stack.length - 1;
			if (key && key === persistedKey) {
				setPersistedRoute(null);
				reserved = false;
			}
			if (index < 0) {
				sync();
				return;
			}
			forget(stack.splice(index, 1)[0]);
			reserved = false;
			show();
			sync();
		});

		document.addEventListener(PANEL_DISMISS_EVENT, () => {
			stack = stack.filter((e) => e.scope === "app");
			reserved = false;
			show();
			sync();
		});

		document.addEventListener(PANEL_SET_TITLE_EVENT, (event) => {
			const { title } = (event as CustomEvent).detail ?? {};
			// Only base page panels (Insights, reconcile) set titles; one stacked on top keeps its own.
			const base = stack.find((e) => e.scope === "page") ?? stack[0];
			if (!base) {
				return;
			}
			base.title = getSafeTitle(title, base.title);
			if (base === stack.at(-1)) {
				panelState.title = base.title;
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
	return persisted?.route === here();
}

/** wasPanelPersistedOpen without the wait; undefined until the side panel has loaded. */
export function isPanelPersistedOpen(): boolean | undefined {
	return persistedRoute === undefined ? undefined : persistedRoute === here();
}

export { sidepanel } from "./api";
export type { OpenOptions, SidePanelApi } from "./api";
