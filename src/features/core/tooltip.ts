import { ACTUAL_TOOLTIP } from "@lib/actual-dom";
import { applyGlobalCSS } from "@lib/dom/dom";
import { clamp } from "@lib/math";

/*
 * Every `title` on the page, ABT's and Actual's, shown as ABT's tooltip. An element can add a muted
 * hint line (`data-abt-tip-hint`), shortcut keys (`data-abt-tip-keys`, space-separated) and the
 * side it prefers (`data-abt-tip-side`: bottom by default, or top, left or right). ABT's own
 * elements put their text in `data-abt-tip` instead of `title`, so the browser never draws its own.
 */
const TOOLTIP_CLASS = "abt-tooltip";
const ORIG_TITLE_ATTR = "data-abt-title";
export const TIP_TEXT_ATTR = "data-abt-tip";
export const TIP_HINT_ATTR = "data-abt-tip-hint";
export const TIP_KEYS_ATTR = "data-abt-tip-keys";
export const TIP_SIDE_ATTR = "data-abt-tip-side";
type Side = "top" | "bottom" | "left" | "right";
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const SHOW_DELAY_MS = 600;
// Moving on to another titled element within this long of the last tooltip shows it at once.
const WARM_MS = 500;
const GAP = 7;
const EDGE = 8;

const CSS = `
	/* On the tooltip itself, so the tints follow a variant's own background. */
	.${TOOLTIP_CLASS},
	${ACTUAL_TOOLTIP} {
		--abt-tip-bg: var(--color-tooltipBackground, var(--color-pageBackground));
		--abt-tip-text: var(--color-tooltipText, var(--color-pageText));
		--abt-tip-muted: color-mix(in srgb, var(--abt-tip-text) 62%, transparent);
		--abt-tip-line: color-mix(in srgb, var(--abt-tip-text) 12%, var(--abt-tip-bg));
		--abt-tip-shadow: 0 2px 6px rgb(0 0 0 / 0.1); /* raw: lighter than shadow-sm for a small label */
	}
	/* Over the sidebar, which can be dark in a light theme, a step up from the sidebar's colours. */
	.${TOOLTIP_CLASS}[data-on-sidebar] {
		--abt-tip-bg: color-mix(in srgb, var(--color-sidebarItemText) 10%, var(--color-sidebarBackground));
		--abt-tip-text: var(--color-sidebarItemText);
		--abt-tip-shadow: 0 2px 8px rgb(0 0 0 / 0.3); /* raw: reads on a dark sidebar */
	}
	.${TOOLTIP_CLASS} {
		position: fixed;
		/* Above the sidebar's own layers, which reach 9999999. */
		z-index: 10000000;
		display: none;
		flex-direction: column;
		gap: var(--abt-space-2);
		box-sizing: border-box;
		max-width: 260px;
		/* Actual's page styles the tooltip too: its overflow: auto would clip the arrow, and its
		   border wouldn't match the arrow's edge. */
		overflow: visible !important;
		padding: var(--abt-space-2) var(--abt-space-3);
		border: 1px solid var(--abt-tip-line) !important;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-tip-bg);
		box-shadow: var(--abt-tip-shadow);
		color: var(--abt-tip-text);
		font-family: inherit;
		font-size: var(--abt-text-base);
		line-height: 1.4;
		pointer-events: none;
	}
	.${TOOLTIP_CLASS}[data-open] {
		display: flex;
		animation: abt-tooltip-in 170ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	.${TOOLTIP_CLASS}[data-instant] {
		animation: none;
	}
	/* Grows out of the arrow, with a small overshoot. */
	@keyframes abt-tooltip-in {
		from {
			opacity: 0;
			transform: translate(var(--abt-tip-from-x, 0), var(--abt-tip-from-y, -3px)) scale(0.94);
		}
	}
	.${TOOLTIP_CLASS}[data-side="bottom"] {
		transform-origin: var(--abt-tip-arrow, 50%) 0;
	}
	.${TOOLTIP_CLASS}[data-side="top"] {
		--abt-tip-from-y: 3px;
		transform-origin: var(--abt-tip-arrow, 50%) 100%;
	}
	.${TOOLTIP_CLASS}[data-side="left"] {
		--abt-tip-from-x: 3px;
		--abt-tip-from-y: 0;
		transform-origin: 100% var(--abt-tip-arrow, 50%);
	}
	.${TOOLTIP_CLASS}[data-side="right"] {
		--abt-tip-from-x: -3px;
		--abt-tip-from-y: 0;
		transform-origin: 0 var(--abt-tip-arrow, 50%);
	}
	.abt-tooltip__row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-4);
	}
	.abt-tooltip__label {
		flex: 1;
		font-weight: 500;
		white-space: pre-line;
	}
	.abt-tooltip__hint {
		color: var(--abt-tip-muted);
		font-size: var(--abt-text-sm);
		white-space: pre-line;
	}
	.abt-tooltip__keys {
		display: flex;
		flex: none;
		gap: var(--abt-space-1);
	}
	.abt-tooltip__keys kbd {
		min-width: 16px;
		padding: 0 var(--abt-space-2);
		border-radius: var(--abt-radius-sm);
		background: var(--abt-tip-line);
		color: var(--abt-tip-muted);
		font: inherit;
		font-size: var(--abt-text-xs);
		line-height: 16px;
		text-align: center;
	}
	/* Points at the element. Drawn pointing up; its base covers the tooltip's border so the edge
	   runs on into the arrow's sides. */
	.abt-tooltip__arrow {
		position: absolute;
		display: block;
		width: 14px;
		height: 8px;
		fill: var(--abt-tip-bg);
		stroke: var(--abt-tip-line);
		stroke-linejoin: round;
	}
	.${TOOLTIP_CLASS}[data-side="bottom"] .abt-tooltip__arrow {
		top: -8px;
		left: var(--abt-tip-arrow, 50%);
		margin-left: -7px;
	}
	.${TOOLTIP_CLASS}[data-side="top"] .abt-tooltip__arrow {
		bottom: -8px;
		left: var(--abt-tip-arrow, 50%);
		margin-left: -7px;
		transform: rotate(180deg);
	}
	/* Turned on its side, the 14x8 box needs moving 3px further out to sit flush. */
	.${TOOLTIP_CLASS}[data-side="right"] .abt-tooltip__arrow {
		left: -11px;
		top: var(--abt-tip-arrow, 50%);
		margin-top: -4px;
		transform: rotate(-90deg);
	}
	.${TOOLTIP_CLASS}[data-side="left"] .abt-tooltip__arrow {
		right: -11px;
		top: var(--abt-tip-arrow, 50%);
		margin-top: -4px;
		transform: rotate(90deg);
	}
	/* Actual's own text tooltips (the titlebar's buttons), matched to ABT's. Ones with content of
	   their own, like balance breakdowns, keep Actual's layout. Its inline styles need !important. */
	${ACTUAL_TOOLTIP}:not(:has(*)) {
		padding: var(--abt-space-2) var(--abt-space-3) !important;
		border: 1px solid var(--abt-tip-line) !important;
		border-radius: var(--abt-radius-sm) !important;
		background: var(--abt-tip-bg) !important;
		box-shadow: var(--abt-tip-shadow) !important;
		color: var(--abt-tip-text) !important;
		font-size: var(--abt-text-base);
		font-weight: 500;
		line-height: 1.4;
		animation: abt-tooltip-in 170ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	${ACTUAL_TOOLTIP}[data-placement="top"] {
		--abt-tip-from-y: 3px;
	}
	${ACTUAL_TOOLTIP}:is([data-placement="left"], [data-placement="right"]) {
		--abt-tip-from-y: 0;
	}
	${ACTUAL_TOOLTIP}[data-placement="left"] {
		--abt-tip-from-x: 3px;
	}
	${ACTUAL_TOOLTIP}[data-placement="right"] {
		--abt-tip-from-x: -3px;
	}
	@media (prefers-reduced-motion: reduce) {
		.${TOOLTIP_CLASS}[data-open],
		${ACTUAL_TOOLTIP} {
			animation: none !important;
		}
	}
`;

let tooltipEl: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let currentTarget: HTMLElement | null = null;
let lastHidden = 0;
// Held while a pointer button is down (dragging a handle or a slider), and for whatever was under
// it on release, so no tooltip covers what's being dragged or pops up as the drag ends.
let pressed = false;
let quiet: HTMLElement | null = null;

function ensureTooltipEl(): HTMLElement {
	if (!tooltipEl) {
		tooltipEl = document.createElement("div");
		tooltipEl.className = TOOLTIP_CLASS;
		tooltipEl.setAttribute("role", "tooltip");
		document.body.appendChild(tooltipEl);
	}
	return tooltipEl;
}

function findTitledAncestor(node: EventTarget | null): HTMLElement | null {
	let el = node instanceof Element ? (node as HTMLElement) : null;
	while (el && el !== document.body) {
		if (
			el.hasAttribute(TIP_TEXT_ATTR) ||
			el.hasAttribute("title") ||
			el.hasAttribute(ORIG_TITLE_ATTR)
		) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

/** Where the tooltip goes on a side, and whether it fits there inside the window. */
type Size = { width: number; height: number };

function place(side: Side, a: DOMRect, tip: Size) {
	const vertical = side === "top" || side === "bottom";
	const top =
		side === "bottom"
			? a.bottom + GAP
			: side === "top"
				? a.top - tip.height - GAP
				: a.top + a.height / 2 - tip.height / 2;
	const left =
		side === "right"
			? a.right + GAP
			: side === "left"
				? a.left - tip.width - GAP
				: a.left + a.width / 2 - tip.width / 2;
	const fits = vertical
		? top >= EDGE && top + tip.height <= window.innerHeight - EDGE
		: left >= EDGE && left + tip.width <= window.innerWidth - EDGE;
	return { top, left, fits, vertical };
}

function positionTooltip(el: HTMLElement, anchor: HTMLElement) {
	const a = anchor.getBoundingClientRect();
	// offset sizes ignore the opening animation's scale, which would shrink a measured rect.
	const tip: Size = { width: el.offsetWidth, height: el.offsetHeight };
	const wanted = (anchor.getAttribute(TIP_SIDE_ATTR) as Side | null) ?? "bottom";
	let side: Side = wanted in OPPOSITE ? wanted : "bottom";
	let spot = place(side, a, tip);
	if (!spot.fits && place(OPPOSITE[side], a, tip).fits) {
		side = OPPOSITE[side];
		spot = place(side, a, tip);
	}
	const top = clamp(spot.top, EDGE, window.innerHeight - tip.height - EDGE);
	const left = clamp(spot.left, EDGE, window.innerWidth - tip.width - EDGE);

	el.dataset.side = side;
	el.style.top = `${top}px`;
	el.style.left = `${left}px`;
	// The arrow follows the element even when the tooltip is pushed in from a window edge.
	const arrow = spot.vertical
		? clamp(a.left + a.width / 2 - left, 10, tip.width - 10)
		: clamp(a.top + a.height / 2 - top, 10, tip.height - 10);
	el.style.setProperty("--abt-tip-arrow", `${arrow}px`);
}

function restoreTitle(el: HTMLElement) {
	const orig = el.getAttribute(ORIG_TITLE_ATTR);
	if (orig != null) {
		if (!el.hasAttribute("title")) {
			el.setAttribute("title", orig);
		}
		el.removeAttribute(ORIG_TITLE_ATTR);
	}
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** A triangle with a rounded tip. The path stays open along the base, so only the sides are stroked. */
function makeArrow(): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("class", "abt-tooltip__arrow");
	svg.setAttribute("viewBox", "0 0 14 8");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", "M0 8.5 L5.6 1.9 Q7 0.3 8.4 1.9 L14 8.5");
	svg.append(path);
	return svg;
}

function fill(el: HTMLElement, label: string, hint: string | null, keys: string | null) {
	el.replaceChildren(makeArrow());
	const row = document.createElement("span");
	row.className = "abt-tooltip__row";
	const text = document.createElement("span");
	text.className = "abt-tooltip__label";
	text.textContent = label;
	row.append(text);
	if (keys) {
		const group = document.createElement("span");
		group.className = "abt-tooltip__keys";
		for (const key of keys.split(/\s+/).filter(Boolean)) {
			const kbd = document.createElement("kbd");
			kbd.textContent = key;
			group.append(kbd);
		}
		row.append(group);
	}
	el.append(row);
	if (hint) {
		const sub = document.createElement("span");
		sub.className = "abt-tooltip__hint";
		sub.textContent = hint;
		el.append(sub);
	}
}

function showTooltip(anchor: HTMLElement, instant: boolean) {
	const own = anchor.getAttribute(TIP_TEXT_ATTR);
	// A title set again while hidden (a framework re-render) is the newer text.
	const text = own || anchor.getAttribute("title") || anchor.getAttribute(ORIG_TITLE_ATTR);
	if (!text || !anchor.isConnected) {
		return;
	}
	if (!own) {
		// Taken off while shown, so the browser doesn't draw its own tooltip as well.
		anchor.setAttribute(ORIG_TITLE_ATTR, text);
		anchor.removeAttribute("title");
	}

	const el = ensureTooltipEl();
	fill(el, text, anchor.getAttribute(TIP_HINT_ATTR), anchor.getAttribute(TIP_KEYS_ATTR));
	el.toggleAttribute("data-on-sidebar", !!anchor.closest(".sidebar"));
	el.toggleAttribute("data-instant", instant);
	el.style.visibility = "hidden";
	el.setAttribute("data-open", "");
	positionTooltip(el, anchor);
	el.style.visibility = "";
}

function hideTooltip() {
	if (tooltipEl?.hasAttribute("data-open")) {
		tooltipEl.removeAttribute("data-open");
		lastHidden = performance.now();
	}
}

function clearCurrentTarget() {
	if (currentTarget) {
		restoreTitle(currentTarget);
	}
	currentTarget = null;
	if (showTimer) {
		clearTimeout(showTimer);
		showTimer = null;
	}
	hideTooltip();
}

/** Hides the tooltip but keeps the title off until the pointer leaves, so the browser's doesn't
 * appear in its place. */
function dismiss() {
	if (showTimer) {
		clearTimeout(showTimer);
		showTimer = null;
	}
	hideTooltip();
}

function target(next: HTMLElement) {
	if (next === currentTarget) {
		return;
	}
	const warm = tooltipEl?.hasAttribute("data-open") || performance.now() - lastHidden < WARM_MS;
	clearCurrentTarget();
	currentTarget = next;
	if (warm) {
		showTooltip(next, true);
		return;
	}
	showTimer = setTimeout(() => {
		showTimer = null;
		if (currentTarget === next) {
			showTooltip(next, false);
		}
	}, SHOW_DELAY_MS);
}

function onPointerOver(e: MouseEvent) {
	if (pressed) {
		return;
	}
	const next = findTitledAncestor(e.target);
	if (next && next !== quiet) {
		quiet = null;
		target(next);
	}
}

function onPointerDown() {
	pressed = true;
	clearCurrentTarget();
}

function onPointerUp(e: PointerEvent) {
	pressed = false;
	quiet = findTitledAncestor(document.elementFromPoint(e.clientX, e.clientY));
}

function onPointerOut(e: MouseEvent) {
	if (!currentTarget) {
		return;
	}
	const related = e.relatedTarget as Node | null;
	if (related && currentTarget.contains(related)) {
		return;
	}
	clearCurrentTarget();
}

function onLeave(e: MouseEvent) {
	// Leaving the element it was released over lets that one show again next time.
	if (quiet && !(e.relatedTarget instanceof Node && quiet.contains(e.relatedTarget))) {
		if (e.target instanceof Node && quiet.contains(e.target)) {
			quiet = null;
		}
	}
}

function onFocusIn(e: FocusEvent) {
	const el = e.target instanceof HTMLElement ? e.target : null;
	if (el?.matches(":focus-visible")) {
		const next = findTitledAncestor(el);
		if (next) {
			target(next);
		}
	}
}

function onKeyDown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		dismiss();
	}
}

export const tooltipStyling = {
	type: "core" as const,
	init: () => {
		applyGlobalCSS(CSS, "tooltip");
		document.addEventListener("mouseover", onPointerOver, true);
		document.addEventListener("mouseout", onPointerOut, true);
		document.addEventListener("mouseout", onLeave, true);
		window.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("pointerup", onPointerUp, true);
		window.addEventListener("pointercancel", onPointerUp, true);
		document.addEventListener("focusin", onFocusIn, true);
		document.addEventListener("focusout", clearCurrentTarget, true);
		document.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("scroll", dismiss, true);
		window.addEventListener("blur", dismiss);
	},
};
