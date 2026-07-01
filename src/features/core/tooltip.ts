import { applyGlobalCSS } from "@lib/utilities/dom";

const TOOLTIP_CLASS = "abt-tooltip";
const ORIG_TITLE_ATTR = "data-abt-title";
const SHOW_DELAY_MS = 400;
const GAP = 8;

const CSS = `
	.${TOOLTIP_CLASS} {
		position: fixed;
		z-index: 20000;
		display: none;
		max-width: 260px;
		padding: 5px 8px;
		border-radius: 5px;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		font-size: 11px;
		font-family: inherit;
		line-height: 1.4;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
		pointer-events: none;
		white-space: pre-line;
	}
`;

let tooltipEl: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let currentTarget: HTMLElement | null = null;

function ensureTooltipEl(): HTMLElement {
	if (!tooltipEl) {
		tooltipEl = document.createElement("div");
		tooltipEl.className = TOOLTIP_CLASS;
		document.body.appendChild(tooltipEl);
	}
	return tooltipEl;
}

function findTitledAncestor(node: EventTarget | null): HTMLElement | null {
	let el = node as HTMLElement | null;
	while (el && el !== document.body) {
		if (el.hasAttribute("title") || el.hasAttribute(ORIG_TITLE_ATTR)) return el;
		el = el.parentElement;
	}
	return null;
}

function positionTooltip(el: HTMLElement, anchor: HTMLElement) {
	const anchorRect = anchor.getBoundingClientRect();
	const tipRect = el.getBoundingClientRect();

	let top = anchorRect.bottom + GAP;
	if (top + tipRect.height > window.innerHeight - GAP) {
		top = anchorRect.top - tipRect.height - GAP;
	}

	let left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
	left = Math.max(GAP, Math.min(left, window.innerWidth - tipRect.width - GAP));

	el.style.top = `${Math.max(GAP, top)}px`;
	el.style.left = `${left}px`;
}

function restoreTitle(el: HTMLElement) {
	const orig = el.getAttribute(ORIG_TITLE_ATTR);
	if (orig != null) {
		el.setAttribute("title", orig);
		el.removeAttribute(ORIG_TITLE_ATTR);
	}
}

function showTooltip(anchor: HTMLElement) {
	const text = anchor.getAttribute(ORIG_TITLE_ATTR) ?? anchor.getAttribute("title");
	if (!text) return;

	if (anchor.hasAttribute("title")) {
		anchor.setAttribute(ORIG_TITLE_ATTR, text);
		anchor.removeAttribute("title");
	}

	const el = ensureTooltipEl();
	el.textContent = text;
	el.style.visibility = "hidden";
	el.style.display = "block";
	positionTooltip(el, anchor);
	el.style.visibility = "visible";
}

function hideTooltip() {
	if (tooltipEl) tooltipEl.style.display = "none";
}

function clearCurrentTarget() {
	if (currentTarget) restoreTitle(currentTarget);
	currentTarget = null;
	if (showTimer) {
		clearTimeout(showTimer);
		showTimer = null;
	}
	hideTooltip();
}

function onPointerOver(e: MouseEvent) {
	const target = findTitledAncestor(e.target);
	if (!target || target === currentTarget) return;
	if (currentTarget) restoreTitle(currentTarget);
	currentTarget = target;

	if (showTimer) clearTimeout(showTimer);
	showTimer = setTimeout(() => {
		if (currentTarget === target) showTooltip(target);
	}, SHOW_DELAY_MS);
}

function onPointerOut(e: MouseEvent) {
	if (!currentTarget) return;
	const related = e.relatedTarget as Node | null;
	if (related && currentTarget.contains(related)) return;
	clearCurrentTarget();
}

export const tooltipStyling = {
	type: "core" as const,
	init: () => {
		applyGlobalCSS(CSS, "tooltip");
		document.addEventListener("mouseover", onPointerOver, true);
		document.addEventListener("mouseout", onPointerOut, true);
		document.addEventListener("mousedown", clearCurrentTarget, true);
		window.addEventListener("scroll", clearCurrentTarget, true);
		window.addEventListener("blur", clearCurrentTarget);
	},
};
