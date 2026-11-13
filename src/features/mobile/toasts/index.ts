import { defineSetting } from "@features/types";
import { watchDom } from "@lib/dom/dom-watcher";
import { TAB_BAR_ATTR } from "../tab-bar/nav";
import { TOAST } from "@lib/actual-dom";

/*
 * Actual's toasts: a fixed stack holding one role="alert" per toast, each a card whose first
 * button closes it and whose next child holds the rows. The alert's text colour is the kind's.
 */
const STACK_ATTR = "data-abt-m-toasts";
const CARD = `${TOAST} > div`;
const CLOSE = `${CARD} > button:first-child`;
const CONTENT = `${CARD} > div`;
const ACTION = `${CONTENT} button`;

function markStacks() {
	for (const toast of document.querySelectorAll(TOAST)) {
		const stack = toast.parentElement?.parentElement;
		if (stack && !stack.hasAttribute(STACK_ATTR) && getComputedStyle(stack).position === "fixed") {
			stack.setAttribute(STACK_ATTR, "");
		}
	}
}

export const mobileToasts = defineSetting({
	type: "checkbox",
	label: "Snackbar toasts",
	description: "Shows notifications as snackbars above the tab bar.",
	group: "Mobile",
	icon: "bell",
	platform: "mobile",
	context: {
		key: "mobile-toasts",
		defaultValue: false,
	},
	css: () => `
		[${STACK_ATTR}] {
			left: var(--abt-space-4) !important;
			right: var(--abt-space-4) !important;
		}

		:root[${TAB_BAR_ATTR}] [${STACK_ATTR}] {
			bottom: calc(56px + env(safe-area-inset-bottom) + var(--abt-space-3)) !important;
		}

		${CARD} {
			max-width: none !important;
			min-height: 48px;
			box-sizing: border-box;
			justify-content: center;
			padding: var(--abt-space-4) 44px var(--abt-space-4) 30px !important;
			border: 0 !important;
			border-radius: var(--abt-radius-lg) !important;
			background: color-mix(in srgb, var(--color-menuBackground) 90%, transparent) !important;
			backdrop-filter: blur(20px) saturate(1.5);
			box-shadow: var(--abt-shadow-sm) !important;
			font-size: var(--abt-text-lg) !important;
			line-height: 1.4;
		}

		/* The kind (done, warning, error) as a dot, in the colour Actual gives the alert. */
		${CARD}::before {
			content: "";
			position: absolute;
			top: 50%;
			left: var(--abt-space-4);
			width: 8px;
			height: 8px;
			margin-top: -4px;
			border-radius: var(--abt-radius-pill);
			background: currentColor;
		}

		${CONTENT} {
			color: var(--color-menuItemText);
		}

		${CONTENT} div {
			font-size: inherit !important;
		}

		${ACTION} {
			height: 32px;
			padding: 0 var(--abt-space-3) !important;
			border: 0 !important;
			background: none !important;
			color: var(--abt-accent) !important;
			font-size: var(--abt-text-lg) !important;
			font-weight: 600;
			align-self: center;
		}

		${CLOSE} {
			top: 50% !important;
			right: var(--abt-space-3) !important;
			transform: translateY(-50%);
			color: var(--color-menuItemText) !important;
			opacity: 0.45 !important;
		}
	`,
	init: () => {
		const stop = watchDom(markStacks);
		return () => {
			stop();
			for (const el of document.querySelectorAll(`[${STACK_ATTR}]`)) {
				el.removeAttribute(STACK_ATTR);
			}
		};
	},
});
