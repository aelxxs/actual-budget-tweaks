const BODY_CSS = ".css-1y7d8dh";

import { applyGlobalCSS, createElement } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

const LAYOUT_ATTR = "data-abt-side-drawer-layout";
const ROW_ATTR = "data-abt-side-drawer-row";
const SIDEBAR_ATTR = "data-abt-side-drawer-sidebar";
const RESIZE_HANDLE_ATTR = "data-abt-side-drawer-resize-handle";
const OPEN_BUTTON_ATTR = "data-abt-side-drawer-open-button";
const CLOSE_BUTTON_ATTR = "data-abt-side-drawer-close-button";
const SIDEBAR_CLOSING_CLASS = "abt-side-drawer-sidebar-closing";
const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 640;
const BUDGET_CONTENT_SELECTOR = '[data-testid="budget-table"]';
const SIDEBAR_ANIMATION_MS = 110;
const PANEL_OPEN_EVENT = "abt:sidepanel:open";
const PANEL_CLOSE_EVENT = "abt:sidepanel:close";
const PANEL_SET_TITLE_EVENT = "abt:sidepanel:set-title";
const PANEL_SET_TRIGGER_LABEL_EVENT = "abt:sidepanel:set-trigger-label";

let panelTitle = "Side Panel";
let panelTriggerLabel = "";
let externalPanelBody: Node | null = null;

type SidePanelApi = {
	open: (title?: string, bodyNode?: unknown) => void;
	close: () => void;
	setTitle: (title: string) => void;
	setPanelTriggerLabel: (label: string) => void;
	isOpen: () => boolean;
};

function getSafeTitle(title: unknown) {
	if (typeof title !== "string") {
		return panelTitle;
	}

	const trimmed = title.trim();
	return trimmed.length ? trimmed : panelTitle;
}

function isDomNodeLike(value: unknown): value is Node {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as { nodeType?: unknown; nodeName?: unknown };
	return typeof candidate.nodeType === "number" && typeof candidate.nodeName === "string";
}

function clampSidebarWidth(width: number) {
	return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

function setSidebarWidth(width: number) {
	const sidebar = document.querySelector(`[${SIDEBAR_ATTR}]`) as HTMLDivElement | null;
	if (!sidebar) {
		return;
	}

	const resolvedWidth = clampSidebarWidth(width);
	sidebar.style.width = `${resolvedWidth}px`;
	sidebar.style.minWidth = `${resolvedWidth}px`;
	sidebar.style.flexBasis = `${resolvedWidth}px`;
}

function attachResizeHandle(sidebar: HTMLDivElement, initialWidth: number, onResizeEnd: (width: number) => void) {
	const handle = createElement("div", {
		className: "abt-side-drawer-resize-handle",
	});
	handle.setAttribute(RESIZE_HANDLE_ATTR, "true");

	handle.addEventListener("pointerdown", (event) => {
		event.preventDefault();

		const startX = event.clientX;
		const startWidth = sidebar.getBoundingClientRect().width || initialWidth;

		const onPointerMove = (moveEvent: PointerEvent) => {
			const nextWidth = clampSidebarWidth(startWidth + (startX - moveEvent.clientX));
			setSidebarWidth(nextWidth);
		};

		const onPointerUp = (upEvent: PointerEvent) => {
			const nextWidth = clampSidebarWidth(startWidth + (startX - upEvent.clientX));
			setSidebarWidth(nextWidth);
			onResizeEnd(nextWidth);
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
			document.body.style.userSelect = "";
		};

		document.body.style.userSelect = "none";
		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);
	});

	sidebar.appendChild(handle);
}

function getOpenButton() {
	return document.querySelector(`[${OPEN_BUTTON_ATTR}]`) as HTMLButtonElement | null;
}

function removeOpenButton() {
	getOpenButton()?.remove();
}

function injectPageApiBridge() {
	const bridgeTarget = window as unknown as { abtSidepanel?: SidePanelApi };
	if (bridgeTarget.abtSidepanel) {
		return;
	}

	bridgeTarget.abtSidepanel = {
		open: (title?: string, bodyNode?: unknown) => {
			document.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: { title, bodyNode } }));
		},
		close: () => {
			document.dispatchEvent(new CustomEvent(PANEL_CLOSE_EVENT));
		},
		setTitle: (title: string) => {
			document.dispatchEvent(new CustomEvent(PANEL_SET_TITLE_EVENT, { detail: { title } }));
		},
		setPanelTriggerLabel: (label: string) => {
			document.dispatchEvent(new CustomEvent(PANEL_SET_TRIGGER_LABEL_EVENT, { detail: { label } }));
		},
		isOpen: () => {
			return !!document.querySelector(`[${SIDEBAR_ATTR}]`);
		},
	};
}

function animateSidebarClose(onClose: () => void) {
	const sidebar = document.querySelector(`[${SIDEBAR_ATTR}]`) as HTMLDivElement | null;
	if (!sidebar || sidebar.classList.contains(SIDEBAR_CLOSING_CLASS)) {
		onClose();
		return;
	}

	sidebar.classList.add(SIDEBAR_CLOSING_CLASS);

	let isSettled = false;
	const finishClose = () => {
		if (isSettled) {
			return;
		}
		isSettled = true;
		sidebar.removeEventListener("animationend", handleAnimationEnd);
		onClose();
	};

	const handleAnimationEnd = (event: AnimationEvent) => {
		if (event.target !== sidebar) {
			return;
		}
		finishClose();
	};

	sidebar.addEventListener("animationend", handleAnimationEnd);
	window.setTimeout(finishClose, SIDEBAR_ANIMATION_MS + 40);
}

function createDrawerIcon(direction: "open" | "close") {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("aria-hidden", "true");
	svg.style.width = "16px";
	svg.style.height = "16px";
	svg.style.display = "block";

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute(
		"d",
		direction === "open"
			? "M15.41 7.41 10.83 12l4.58 4.59L14 18l-6-6 6-6z"
			: "M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z",
	);
	svg.appendChild(path);

	return svg;
}

function ensureOpenButton(onOpen: () => void) {
	const existing = getOpenButton();
	if (existing) {
		// Update label if needed
		// Remove all child nodes after the icon (first child)
		while (existing.childNodes.length > 1) {
			existing.removeChild(existing.lastChild!);
		}
		existing.appendChild(document.createTextNode(panelTriggerLabel));
		return;
	}

	const button = createElement("button", {
		className: "abt-side-drawer-open-button",
		type: "button",
		title: "Open side drawer",
		ariaLabel: "Open side drawer",
	});
	button.setAttribute(OPEN_BUTTON_ATTR, "true");
	button.appendChild(createDrawerIcon("open"));
	button.appendChild(document.createTextNode(panelTriggerLabel));
	button.addEventListener("click", () => {
		onOpen();
	});
	document.body.appendChild(button);
}

function createCloseButton(onClose: () => void) {
	const button = createElement("button", {
		className: "abt-side-drawer-close-button",
		type: "button",
		title: "Close side drawer",
		ariaLabel: "Close side drawer",
	});
	button.setAttribute(CLOSE_BUTTON_ATTR, "true");
	button.appendChild(createDrawerIcon("close"));
	button.addEventListener("click", () => animateSidebarClose(onClose));
	return button;
}

function createPanelContent(onClose: () => void) {
	const content = createElement("div", {
		className: "abt-side-drawer-content",
	});

	const header = createElement("div", {
		className: "abt-side-drawer-header",
	});

	const title = createElement("h2", {
		className: "abt-side-drawer-title",
		textContent: panelTriggerLabel,
	});

	const closeButton = createCloseButton(onClose);
	header.append(title, closeButton);

	const body = createElement("div", {
		className: "abt-side-drawer-body",
	});

	if (externalPanelBody) {
		body.appendChild(externalPanelBody);
	}

	content.append(header, body);
	return content;
}

function isBudgetPage() {
	return window.location.pathname === "/budget";
}

function getBodyElement() {
	const candidates = Array.from(document.querySelectorAll(BODY_CSS)) as HTMLElement[];
	if (!candidates.length) {
		return null;
	}

	const eligibleCandidates = candidates.filter((candidate) => !candidate.closest(`[${ROW_ATTR}]`));
	const budgetCandidates = (eligibleCandidates.length ? eligibleCandidates : candidates).filter((candidate) =>
		candidate.querySelector(BUDGET_CONTENT_SELECTOR),
	);
	if (budgetCandidates.length) {
		return budgetCandidates[0] ?? null;
	}

	return (eligibleCandidates.length ? eligibleCandidates : candidates)[0] ?? null;
}

function getLayoutWrapper() {
	return document.querySelector(`[${LAYOUT_ATTR}]`) as HTMLDivElement | null;
}

function applySideDrawerLayout(sidebarWidth: number, onResizeEnd: (width: number) => void, onClose: () => void) {
	const body = getBodyElement();
	if (!body || !body.parentElement || body.closest(`[${ROW_ATTR}]`) || !body.querySelector(BUDGET_CONTENT_SELECTOR)) {
		return;
	}

	removeOpenButton();

	const wrapper = createElement("div", {
		className: "abt-side-drawer-layout",
	});
	wrapper.setAttribute(LAYOUT_ATTR, "true");

	const row = createElement("div", {
		className: "abt-side-drawer-row",
	});
	row.setAttribute(ROW_ATTR, "true");

	const sidebar = createElement("div", {
		className: "abt-side-drawer-sidebar",
		ariaHidden: "false",
	});
	sidebar.setAttribute(SIDEBAR_ATTR, "true");
	attachResizeHandle(sidebar, sidebarWidth, onResizeEnd);
	sidebar.appendChild(createPanelContent(onClose));

	body.parentElement.insertBefore(wrapper, body);
	wrapper.appendChild(row);
	row.append(body, sidebar);
	setSidebarWidth(sidebarWidth);
}

function removeSideDrawerLayout() {
	const wrapper = getLayoutWrapper();
	if (!wrapper) {
		return;
	}

	const body = wrapper.querySelector(BODY_CSS) as HTMLElement | null;
	const parent = wrapper.parentElement;
	if (body && parent) {
		parent.insertBefore(body, wrapper);
	}

	wrapper.remove();
}

function syncSidePanel(
	enabled: boolean,
	isOpen: boolean,
	sidebarWidth: number,
	onResizeEnd: (width: number) => void,
	onOpen: () => void,
	onClose: () => void,
) {
	if (!enabled || !isBudgetPage()) {
		removeSideDrawerLayout();
		removeOpenButton();
		return;
	}

	if (!isOpen) {
		removeSideDrawerLayout();
		ensureOpenButton(onOpen);
		return;
	}

	const wrapper = getLayoutWrapper();
	if (wrapper && !wrapper.querySelector(BODY_CSS)) {
		wrapper.remove();
	}

	applySideDrawerLayout(sidebarWidth, onResizeEnd, onClose);
}

export const sidePanel = defineSetting({
	type: "checkbox",
	label: "Side Panel",
	context: {
		key: "side-panel",
		defaultValue: true,
		openKey: "side-panel-open",
		widthKey: "side-panel-width",
		css: () => `
			.css-3oa7u7:has(> [data-abt-side-drawer-layout="true"]) {
				padding-right: 0px;
				padding-top: 0px;
			}

			@keyframes abt-side-drawer-enter {
				from {
					opacity: 0;
					transform: translateX(14px);
				}

				to {
					opacity: 1;
					transform: translateX(0);
				}
			}

			@keyframes abt-side-drawer-trigger-enter {
				from {
					opacity: 0;
					transform: translateX(12px);
				}

				to {
					opacity: 1;
					transform: translateX(0);
				}
			}

			@keyframes abt-side-drawer-exit {
				from {
					opacity: 1;
					transform: translateX(0);
				}

				to {
					opacity: 0;
					transform: translateX(14px);
				}
			}

			.abt-side-drawer-layout {
				display: flex;
				flex-direction: column;
				width: 100%;
				height: 100%;
				min-height: 0;
			}
			.abt-side-drawer-row {
				display: flex;
				flex-direction: row;
				width: 100%;
				height: 100%;
				min-height: 0;
				align-items: stretch;
			}
			.abt-side-drawer-sidebar,
			.abt-side-drawer-row > ${BODY_CSS} {
				min-height: 0;
				overflow-y: auto;
				flex: 1 1 0;
			}
			.abt-side-drawer-sidebar {
				flex: 0 0 var(--sidebar-width, 320px);
				width: var(--sidebar-width, 320px);
				min-width: 240px;
				max-width: 640px;
			}

			.abt-side-drawer-row {
				display: flex;
				gap: 0;
				width: 100%;
				align-items: stretch;
			}

			.abt-side-drawer-sidebar {
				position: relative;
				display: flex;
				flex-direction: column;
				flex: 0 0 ${DEFAULT_SIDEBAR_WIDTH}px;
				width: ${DEFAULT_SIDEBAR_WIDTH}px;
				min-width: ${MIN_SIDEBAR_WIDTH}px;
				background: var(--color-sidebarBackground);
				border-left: var(--border);
				animation: abt-side-drawer-enter 110ms cubic-bezier(0.2, 0.8, 0.2, 1);
			}

			.abt-side-drawer-content {
				display: flex;
				flex-direction: column;
				min-height: 0;
				height: 100%;
			}

			.abt-side-drawer-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				padding: 12px 12px 10px;
				border-bottom: var(--border);
			}

			.abt-side-drawer-title {
				margin: 0;
				font-size: 14px;
				line-height: 1.3;
				font-weight: 700;
				color: var(--color-pageText);
			}

			.abt-side-drawer-body {
				// flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
			}

			.abt-side-drawer-sidebar.${SIDEBAR_CLOSING_CLASS} {
				pointer-events: none;
				animation: abt-side-drawer-exit 90ms cubic-bezier(0.4, 0, 1, 1) forwards;
			}

			.abt-side-drawer-close-button,
			.abt-side-drawer-open-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 2px;
				width: 32px;
				height: 32px;
				border: 0;
				padding: 0;
				cursor: pointer;
				color: var(--color-pageText);
				background: var(--color-sidebarItemBackgroundHover);
			}

			.abt-side-drawer-close-button {
				position: static;
				width: 28px;
				height: 28px;
				border-radius: 999px;
				flex-shrink: 0;
			}

			.abt-side-drawer-open-button {
				position: fixed;
				top: 55px;
				right: 0;
				width: auto;
				padding: 0 4px 0 4px;
				border: var(--border);
				border-right: 0;
				border-top-left-radius: 999px;
				border-bottom-left-radius: 999px;
				z-index: 50;
				animation: abt-side-drawer-trigger-enter 110ms cubic-bezier(0.2, 0.8, 0.2, 1);
			}

			.abt-side-drawer-resize-handle {
				position: absolute;
				top: 0;
				left: -4px;
				width: 8px;
				height: 100%;
				cursor: col-resize;
				z-index: 1;
			}

			.abt-side-drawer-row > ${BODY_CSS} {
				flex: 1 1 auto;
				min-width: 0;
				padding-top: 1.5rem;
				padding-right: 0.5rem;
			}
		`,
		_enabled: false,
		_isOpen: true,
		_sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
		_applySync: null as null | (() => void),
		_observer: null as MutationObserver | null,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		const isOpen = await getValue(ctx.openKey, true);
		const sidebarWidth = await getValue(ctx.widthKey, DEFAULT_SIDEBAR_WIDTH);
		ctx._enabled = Boolean(enabled);
		ctx._isOpen = Boolean(isOpen);
		ctx._sidebarWidth = clampSidebarWidth(Number(sidebarWidth));
		panelTriggerLabel = "";
		applyGlobalCSS(ctx.css(), ctx.key);

		injectPageApiBridge();

		const sync = () => {
			syncSidePanel(
				ctx._enabled,
				ctx._isOpen,
				ctx._sidebarWidth,
				(width) => {
					ctx._sidebarWidth = width;
					setValue(ctx.widthKey, width);
				},
				() => {
					ctx._isOpen = true;
					setValue(ctx.openKey, true);
					sync();
				},
				() => {
					ctx._isOpen = false;
					setValue(ctx.openKey, false);
					sync();
				},
			);
		};
		ctx._applySync = sync;

		const panelApi: SidePanelApi = {
			open: (title, bodyNode) => {
				panelTitle = getSafeTitle(title);
				externalPanelBody = isDomNodeLike(bodyNode) ? (bodyNode as Node) : null;
				ctx._isOpen = true;
				setValue(ctx.openKey, true);
				ctx._applySync?.();
			},
			close: () => {
				ctx._isOpen = false;
				setValue(ctx.openKey, false);
				ctx._applySync?.();
			},
			setTitle: (title) => {
				panelTitle = getSafeTitle(title);
				ctx._applySync?.();
			},
			setPanelTriggerLabel: (label) => {
				panelTriggerLabel = label;
				ctx._applySync?.();
			},
			isOpen: () => {
				return ctx._isOpen;
			},
		};

		(window as unknown as { abtSidepanel?: SidePanelApi }).abtSidepanel = panelApi;

		document.addEventListener(PANEL_OPEN_EVENT, (event) => {
			const detail = (event as CustomEvent<{ title?: unknown; bodyNode?: unknown }>).detail ?? {};
			panelApi.open(typeof detail.title === "string" ? detail.title : undefined, detail.bodyNode);
		});

		document.addEventListener(PANEL_CLOSE_EVENT, () => {
			panelApi.close();
		});

		document.addEventListener(PANEL_SET_TITLE_EVENT, (event) => {
			const detail = (event as CustomEvent<{ title?: unknown }>).detail ?? {};
			panelApi.setTitle(typeof detail.title === "string" ? detail.title : panelTitle);
		});

		document.addEventListener(PANEL_SET_TRIGGER_LABEL_EVENT, (event) => {
			const detail = (event as CustomEvent<{ label?: unknown }>).detail ?? {};
			panelApi.setPanelTriggerLabel(typeof detail.label === "string" ? detail.label : panelTriggerLabel);
		});

		const observer = new MutationObserver(() => {
			observer.disconnect();
			requestAnimationFrame(() => {
				ctx._applySync?.();
				observer.observe(document.body, {
					childList: true,
					subtree: true,
				});
			});
		});

		ctx._observer = observer;
		if (enabled) {
			ctx._applySync?.();
			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		ctx._enabled = value;

		if (value) {
			applyGlobalCSS(ctx.css(), ctx.key);
			ctx._applySync?.();
			ctx._observer?.observe(document.body, {
				childList: true,
				subtree: true,
			});
			return;
		}

		ctx._observer?.disconnect();
		removeSideDrawerLayout();
		removeOpenButton();
		externalPanelBody = null;
		applyGlobalCSS("", ctx.key);
	},
});
