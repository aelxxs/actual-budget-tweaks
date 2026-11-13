import { ACTUAL_TOOLTIP } from "@lib/actual-dom";
import { applyGlobalCSS } from "@lib/utilities/dom";

/*
 * Every `title` on the page, ABT's and Actual's, shown as ABT's tooltip. An element can add a muted
 * hint line (`data-abt-tip-hint`), shortcut keys (`data-abt-tip-keys`, space-separated) and the
 * side it prefers (`data-abt-tip-side`: bottom by default, or top, left or right).
 */
const TOOLTIP_CLASS = "abt-tooltip";
const ORIG_TITLE_ATTR = "data-abt-title";
export const TIP_HINT_ATTR = "data-abt-tip-hint";
export const TIP_KEYS_ATTR = "data-abt-tip-keys";
export const TIP_SIDE_ATTR = "data-abt-tip-side";
type Side = "top" | "bottom" | "left" | "right";
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const SHOW_DELAY_MS = 300;
// Moving on to another titled element within this long of the last tooltip shows it at once.
const WARM_MS = 500;
const GAP = 8;
const EDGE = 8;

const CSS = `
	.${TOOLTIP_CLASS} {
		position: fixed;
		/* Above the sidebar's own layers, which reach 9999999. */
		z-index: 10000000;
		display: none;
		flex-direction: column;
		gap: var(--abt-space-1);
		box-sizing: border-box;
		max-width: 240px;
		padding: var(--abt-space-2) var(--abt-space-3);
		font-family: inherit;
		font-size: var(--abt-text-sm);
		line-height: 1.35;
		pointer-events: none;
	}
	/* Lighter than a menu: smaller corners and shadow on the shared popover surface. */
	.${TOOLTIP_CLASS}.abt-popover {
		border-radius: var(--abt-radius-sm);
		box-shadow: var(--abt-shadow-sm);
	}
	.${TOOLTIP_CLASS}[data-open] {
		display: flex;
		animation: abt-tooltip-in 100ms ease-out;
	}
	.${TOOLTIP_CLASS}[data-instant] {
		animation: none;
	}
	@keyframes abt-tooltip-in {
		from {
			opacity: 0;
			transform: translate(var(--abt-tip-from-x, 0), var(--abt-tip-from-y, -3px));
		}
	}
	.${TOOLTIP_CLASS}[data-side="top"] {
		--abt-tip-from-y: 3px;
	}
	.${TOOLTIP_CLASS}[data-side="left"] {
		--abt-tip-from-x: 3px;
		--abt-tip-from-y: 0;
	}
	.${TOOLTIP_CLASS}[data-side="right"] {
		--abt-tip-from-x: -3px;
		--abt-tip-from-y: 0;
	}
	.abt-tooltip__row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.abt-tooltip__label {
		flex: 1;
		font-weight: 500;
		white-space: pre-line;
	}
	.abt-tooltip__hint {
		color: var(--abt-muted);
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
		background: var(--abt-ink-2);
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-xs);
		line-height: 18px;
		text-align: center;
	}
	/* Points at the element: a square turned to a diamond, half hidden behind the tooltip. */
	.${TOOLTIP_CLASS}::before {
		content: "";
		position: absolute;
		width: 7px;
		height: 7px;
		border: inherit;
		background: inherit;
		transform: rotate(45deg);
	}
	.${TOOLTIP_CLASS}:is([data-side="top"], [data-side="bottom"])::before {
		left: var(--abt-tip-arrow, 50%);
		margin-left: -4px;
	}
	.${TOOLTIP_CLASS}:is([data-side="left"], [data-side="right"])::before {
		top: var(--abt-tip-arrow, 50%);
		margin-top: -4px;
	}
	.${TOOLTIP_CLASS}[data-side="bottom"]::before {
		top: -4px;
		border-right: 0;
		border-bottom: 0;
	}
	.${TOOLTIP_CLASS}[data-side="top"]::before {
		bottom: -4px;
		border-top: 0;
		border-left: 0;
	}
	.${TOOLTIP_CLASS}[data-side="right"]::before {
		left: -4px;
		border-top: 0;
		border-right: 0;
	}
	.${TOOLTIP_CLASS}[data-side="left"]::before {
		right: -4px;
		border-bottom: 0;
		border-left: 0;
	}
	/* Actual's own text tooltips (the titlebar's buttons), matched to ABT's. Ones with content of
	   their own, like balance breakdowns, keep Actual's layout. Its inline styles need !important. */
	${ACTUAL_TOOLTIP}:not(:has(*)) {
		padding: var(--abt-space-2) var(--abt-space-3) !important;
		border: 1px solid var(--color-tableBorder) !important;
		border-radius: var(--abt-radius-sm) !important;
		box-shadow: var(--abt-shadow-sm) !important;
		font-size: var(--abt-text-sm);
		font-weight: 500;
		line-height: 1.35;
		animation: abt-tooltip-in 100ms ease-out;
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
		tooltipEl.className = `${TOOLTIP_CLASS} abt-popover`;
		tooltipEl.setAttribute("role", "tooltip");
		document.body.appendChild(tooltipEl);
	}
	return tooltipEl;
}

function findTitledAncestor(node: EventTarget | null): HTMLElement | null {
	let el = node instanceof Element ? (node as HTMLElement) : null;
	while (el && el !== document.body) {
		if (el.hasAttribute("title") || el.hasAttribute(ORIG_TITLE_ATTR)) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/** Where the tooltip goes on a side, and whether it fits there inside the window. */
function place(side: Side, a: DOMRect, tip: DOMRect) {
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
	const tip = el.getBoundingClientRect();
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

function fill(el: HTMLElement, label: string, hint: string | null, keys: string | null) {
	el.replaceChildren();
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
	// A title set again while hidden (a framework re-render) is the newer text.
	const text = anchor.getAttribute("title") || anchor.getAttribute(ORIG_TITLE_ATTR);
	if (!text || !anchor.isConnected) {
		return;
	}
	// Taken off while shown, so the browser doesn't draw its own tooltip as well.
	anchor.setAttribute(ORIG_TITLE_ATTR, text);
	anchor.removeAttribute("title");

	const el = ensureTooltipEl();
	fill(el, text, anchor.getAttribute(TIP_HINT_ATTR), anchor.getAttribute(TIP_KEYS_ATTR));
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
		clearCurrentTarget();
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
		window.addEventListener("scroll", clearCurrentTarget, true);
		window.addEventListener("blur", clearCurrentTarget);
	},
};
