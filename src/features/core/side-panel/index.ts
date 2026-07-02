import { applyGlobalCSS, createElement } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { clamp } from "@lib/utilities/math";
import { getValue, hasValue, setValue } from "@lib/utilities/store";
import { mountToNode } from "@lib/utilities/svelte";
import {
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

const GRID_CONTAINER = `div:has(> div:nth-child(4)):has([data-testid='budget-table'], [role='main'], [data-testid='account-name'])`;

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

function getBodyElement() {
	return document.querySelector(GRID_CONTAINER) as HTMLElement | null;
}

function removeSideDrawerLayout() {
	document.querySelector(`[${SIDEBAR_ATTR}]`)?.remove();
}

const STORAGE_KEY = "side-panel";
const WIDTH_KEY = "side-panel-width";
const PERSIST_KEY = "side-panel-persist";

const CSS = `
	@keyframes abt-side-drawer-enter {
		from { opacity: 0; transform: translateX(14px); }
		to { opacity: 1; transform: translateX(0); }
	}
	@keyframes abt-side-drawer-exit {
		from { opacity: 1; transform: translateX(0); }
		to { opacity: 0; transform: translateX(14px); }
	}
	${GRID_CONTAINER}:has([${SIDEBAR_ATTR}]) {
		display: grid;
		height: 100vh;
		grid-template-rows: auto 1fr;
		grid-template-columns: 1fr ${DEFAULT_SIDEBAR_WIDTH}px;
		grid-template-areas: "header header" "body sidebar";
	}
	${GRID_CONTAINER}:has([${SIDEBAR_ATTR}]) > div:nth-child(1) {
		grid-area: header;
	}
	${GRID_CONTAINER}:has([${SIDEBAR_ATTR}]) > div:nth-child(2) {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
		z-index: 1000;
	}
	${GRID_CONTAINER}:has([${SIDEBAR_ATTR}]) > div:nth-child(3) {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1000;
	}
	${GRID_CONTAINER}:has([${SIDEBAR_ATTR}]) > div:nth-child(4) {
		grid-area: body;
		overflow-y: auto;
		min-height: 0;
	}
	${GRID_CONTAINER}:has([${SIDEBAR_ATTR}]) > div:nth-child(5) {
		grid-area: sidebar;
	}
	.abt-side-drawer-sidebar {
		position: relative;
		display: flex;
		min-width: ${MIN_SIDEBAR_WIDTH}px;
		max-width: ${MAX_SIDEBAR_WIDTH}px;
		min-height: 0;
		overflow-y: auto;
		background: var(--ctp-secondary-sidebar);
		border-left: var(--border);
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

		let isOpen = storedPersist?.route === location.pathname;
		let sidebarWidth = clamp(Math.round(storedWidth), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);

		const sync = () => {
			if (!isOpen) {
				removeSideDrawerLayout();
				return;
			}

			const body = getBodyElement();
			if (!body) {
				removeSideDrawerLayout();
				return;
			}

			if (document.querySelector(`[${SIDEBAR_ATTR}]`)) return;

			const sidebar = createElement("div", { className: "abt-side-drawer-sidebar" });
			sidebar.setAttribute(SIDEBAR_ATTR, "true");
			sidebar.appendChild(
				mountToNode(SidePanelContent, {
					onClose: () => {
						isOpen = false;
						setValue(PERSIST_KEY, null);
						sync();
					},
					initialWidth: sidebarWidth,
					onResize: (width: number) => {
						body.style.gridTemplateColumns = `1fr ${width}px`;
					},
					onResizeEnd: (width: number) => {
						sidebarWidth = width;
						setValue(WIDTH_KEY, width);
					},
				}),
			);
			body.appendChild(sidebar);
		};

		document.addEventListener(PANEL_OPEN_EVENT, async (event) => {
			const detail: OpenOptions = (event as CustomEvent).detail ?? {};
			panelState.title = getSafeTitle(detail.title, panelState.title);
			panelState.bodyNode = isDomNodeLike(detail.bodyNode) ? detail.bodyNode : null;
			panelState.headerNode = isDomNodeLike(detail.headerNode) ? detail.headerNode : null;

			// Already mounted — panelState above already flowed into the live component, no teardown/remount needed.
			const alreadyOpen = isOpen && !!document.querySelector(`[${SIDEBAR_ATTR}]`);
			isOpen = true;

			if (detail.persist) {
				setValue(PERSIST_KEY, { route: location.pathname });
			}
			if (typeof detail.width === "number" && !(await hasValue(WIDTH_KEY))) {
				sidebarWidth = clamp(Math.round(detail.width), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
			}

			if (!alreadyOpen) {
				removeSideDrawerLayout();
				sync();
			}
		});

		document.addEventListener(PANEL_CLOSE_EVENT, () => {
			isOpen = false;
			setValue(PERSIST_KEY, null);
			sync();
		});

		document.addEventListener(PANEL_DISMISS_EVENT, () => {
			isOpen = false;
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

export { sidepanel } from "./api";
export type { OpenOptions, SidePanelApi } from "./api";
