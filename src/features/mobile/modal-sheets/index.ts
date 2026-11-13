import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { AMOUNT_INPUT, DIALOG, MODAL } from "@lib/actual-dom";

// Every Actual modal: an overlay with a `<name>-modal` test id, a wrapper sized to the visible
// viewport (so it clears the keyboard), react-aria's modal, the dialog, then the content box.
const MODAL_DIALOG = `${MODAL} ${DIALOG}`;
const BOX = `${MODAL_DIALOG} > div:first-of-type`;
// Actual's calculator field (no system keyboard); its keypad, fixed to the screen's bottom but
// rendered inside the modal, comes right after it.
const CALCULATOR_INPUT = `input${AMOUNT_INPUT}[inputmode="none"]`;
/** On a modal's overlay while its keypad is up. */
const KEYPAD_ATTR = "data-abt-m-keypad";
const KEYPAD_PANEL_ATTR = "data-abt-m-keypad-panel";
// Shorter than Actual's (320–400px, half the screen), so the sheet's notes and actions fit above.
const KEYPAD_HEIGHT = "clamp(272px, 40dvh, 340px)";
const SHEET_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const SHEET_MS = 280;

/**
 * Follows each modal's keypad: Actual slides it in and out with an inline transform, so the
 * sheet only rests on it while it's up.
 */
function watchKeypads(): () => void {
	const panels = new Map<HTMLElement, () => void>();

	function mark() {
		for (const [panel, stop] of panels) {
			if (!panel.isConnected) {
				stop();
				panels.delete(panel);
			}
		}
		for (const overlay of document.querySelectorAll(MODAL)) {
			const panel = overlay.querySelector(CALCULATOR_INPUT)?.nextElementSibling;
			if (!(panel instanceof HTMLElement) || panels.has(panel)) {
				continue;
			}
			if (getComputedStyle(panel).position !== "fixed") {
				continue;
			}
			panel.setAttribute(KEYPAD_PANEL_ATTR, "");
			const stop = watchDom(
				() => overlay.toggleAttribute(KEYPAD_ATTR, !panel.style.transform.includes("100%")),
				panel,
				{ attributes: true, attributeFilter: ["style"] },
			);
			panels.set(panel, stop);
		}
	}

	const stopBody = watchDom(mark);
	return () => {
		stopBody();
		for (const stop of panels.values()) {
			stop();
		}
		panels.clear();
	};
}

const HANDLE_ZONE = 32;
const CLOSE_DRAG = 100;
const SETTLE_MS = 200;

/*
 * The sheet moves by its bottom margin, never a transform: a transformed ancestor would pin the
 * keypad to the sheet instead of the screen.
 */

/** Drags a sheet by its top edge; far enough down closes it the way Escape does. */
function watchSwipe(): () => void {
	let drag: { dialog: HTMLElement; startY: number; dy: number } | null = null;

	function onStart(e: TouchEvent) {
		const box = (e.target as Element | null)?.closest?.<HTMLElement>(BOX);
		const dialog = box?.parentElement;
		if (!box || !dialog || e.touches.length !== 1) {
			return;
		}
		const y = e.touches[0].clientY;
		if (y - box.getBoundingClientRect().top > HANDLE_ZONE) {
			return;
		}
		dialog.style.transition = "none";
		drag = { dialog, startY: y, dy: 0 };
	}

	function onMove(e: TouchEvent) {
		if (!drag) {
			return;
		}
		e.preventDefault();
		drag.dy = Math.max(0, e.touches[0].clientY - drag.startY);
		drag.dialog.style.marginBottom = `${-drag.dy}px`;
	}

	function onEnd() {
		if (!drag) {
			return;
		}
		const { dialog, dy } = drag;
		drag = null;
		dialog.style.transition = `margin-bottom ${SETTLE_MS}ms ease`;
		if (dy > CLOSE_DRAG) {
			dialog.style.marginBottom = "-100vh";
			// After the slide, so Actual's own exit doesn't jump back up first.
			setTimeout(() => {
				dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			}, SETTLE_MS);
		} else {
			dialog.style.marginBottom = "";
		}
	}

	document.addEventListener("touchstart", onStart, { passive: true });
	document.addEventListener("touchmove", onMove, { passive: false });
	document.addEventListener("touchend", onEnd);
	document.addEventListener("touchcancel", onEnd);
	return () => {
		document.removeEventListener("touchstart", onStart);
		document.removeEventListener("touchmove", onMove);
		document.removeEventListener("touchend", onEnd);
		document.removeEventListener("touchcancel", onEnd);
	};
}

export const mobileModalSheets = defineSetting({
	type: "checkbox",
	label: "Modals as sheets",
	description: "Opens pop-ups as sheets from the bottom that you swipe down to close.",
	group: "Mobile",
	icon: "panelBottom",
	platform: "mobile",
	context: {
		key: "mobile-modal-sheets",
		defaultValue: false,
	},
	css: () => `
		${MODAL} > div {
			justify-content: flex-end !important;
			align-items: stretch !important;
			overflow: hidden !important;
			transition: padding-bottom ${SHEET_MS}ms ${SHEET_EASE};
		}

		/* The overlay runs under iOS's translucent keyboard, past the sheet (sized to the visible
		   viewport); painted in the sheet's colour, the keyboard sits on the sheet, not the page.
		   ::before, so it paints under the sheet it overlaps. */
		${MODAL}::before {
			content: "";
			position: absolute;
			inset: calc(var(--visual-viewport-height, 100vh) - var(--abt-space-6)) 0 0;
			background: var(--color-modalBackground);
			pointer-events: none;
		}

		/* Rests on the keypad, in place of the gap Actual leaves for it under a centred modal. */
		[${KEYPAD_ATTR}] > div {
			padding-bottom: ${KEYPAD_HEIGHT} !important;
		}

		[${KEYPAD_ATTR}] ${BOX} {
			max-height: calc(var(--visual-viewport-height) - ${KEYPAD_HEIGHT} - var(--abt-space-6)) !important;
			padding-bottom: 10px !important;
		}

		/* The keypad as the sheet's lower half: its height, its motion, no shadow of its own. */
		[${KEYPAD_PANEL_ATTR}] {
			height: ${KEYPAD_HEIGHT} !important;
			min-height: 0 !important;
			max-height: none !important;
			box-shadow: none !important;
			transition-duration: ${SHEET_MS}ms !important;
			transition-timing-function: ${SHEET_EASE} !important;
		}

		${MODAL} > div > div,
		${MODAL_DIALOG} {
			width: 100%;
		}

		${MODAL_DIALOG} {
			animation: abt-sheet-up ${SHEET_MS}ms ${SHEET_EASE};
		}

		${BOX} {
			position: relative !important;
			box-sizing: border-box !important;
			width: 100% !important;
			min-width: 100% !important;
			max-width: 100% !important;
			padding-top: calc(10px + var(--abt-space-5)) !important;
			padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important;
			border-radius: var(--abt-radius-lg) var(--abt-radius-lg) 0 0 !important;
		}

		/* The grab handle. */
		${BOX}::before {
			content: "";
			position: absolute;
			top: var(--abt-space-3);
			left: 50%;
			width: 36px;
			height: 5px;
			margin-left: -18px;
			border-radius: var(--abt-radius-pill);
			background: var(--abt-ink-4);
		}

		@keyframes abt-sheet-up {
			from {
				margin-bottom: -100vh;
			}
		}

		@media (prefers-reduced-motion: reduce) {
			${MODAL_DIALOG} {
				animation: none;
			}
		}
	`,
	init: () => {
		const stopSwipe = watchSwipe();
		const stopKeypads = watchKeypads();
		return () => {
			stopSwipe();
			stopKeypads();
			for (const el of document.querySelectorAll(`[${KEYPAD_ATTR}], [${KEYPAD_PANEL_ATTR}]`)) {
				el.removeAttribute(KEYPAD_ATTR);
				el.removeAttribute(KEYPAD_PANEL_ATTR);
			}
		};
	},
});
