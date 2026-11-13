import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";

// Actual's mobile page header: a row with the <h1> title between left and right buttons. It
// renders into a slot that stays mounted between pages, so the slot is styled with it.
const HEADER_ATTR = "data-abt-m-header";
const HEADER = `[${HEADER_ATTR}]`;
// The budget's month title, a button between two arrow buttons.
const MONTH = `${HEADER} h1 [data-month]`;
// A bar button with an icon and a label: Back.
const BACK_ATTR = "data-abt-m-back";
const CHEVRON_LEFT =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 20' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 2 2 10l8 8'/%3E%3C/svg%3E\")";
const CHEVRON_DOWN =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

function markHeaders() {
	for (const title of document.querySelectorAll("h1")) {
		const row = title.parentElement;
		// Flanked by the left and right buttons' columns, at the top of the screen.
		if (
			row &&
			!row.hasAttribute(HEADER_ATTR) &&
			title.previousElementSibling &&
			title.nextElementSibling &&
			row.getBoundingClientRect().top < 120
		) {
			row.setAttribute(HEADER_ATTR, "");
		}
	}
	for (const icon of document.querySelectorAll(`[${HEADER_ATTR}] > :not(h1) button > svg`)) {
		if (icon.parentElement!.textContent?.trim()) {
			icon.parentElement!.setAttribute(BACK_ATTR, "");
		}
	}
}

export const mobileHeader = defineSetting({
	type: "checkbox",
	label: "Header",
	description: "Gives page headers a native look.",
	group: "Mobile",
	icon: "layout",
	platform: "mobile",
	context: {
		key: "mobile-header",
		defaultValue: false,
	},
	css: () => `
		${HEADER} {
			box-sizing: border-box;
			padding: 0 var(--abt-space-3);
			background: var(--color-mobilePageBackground) !important;
			border-bottom: 1px solid var(--color-tableBorder);
		}

		${HEADER} h1 {
			color: var(--color-pageText) !important;
			font-size: var(--abt-text-xl) !important;
			font-weight: 600 !important;
			letter-spacing: -0.01em;
		}

		${HEADER} h1 * {
			color: inherit !important;
		}

		/* Bar buttons as tinted pills: Back with its label, icon-only ones (add) as circles. Actual
		   tints every descendant, so the colour is set on each. */
		${HEADER} > :not(h1) button,
		${HEADER} > :not(h1) button * {
			color: var(--abt-accent) !important;
		}

		${HEADER} > :not(h1) button {
			box-sizing: border-box;
			height: 32px;
			min-width: 32px;
			margin: 0 var(--abt-space-2);
			/* A lone 16px icon still makes a circle; more (the budget menu's logo and chevron) a pill. */
			padding: 0 var(--abt-space-3) !important;
			gap: var(--abt-space-1);
			justify-content: center;
			border-radius: var(--abt-radius-pill) !important;
			background: var(--abt-accent-2) !important;
			font-size: var(--abt-text-lg) !important;
			font-weight: 500;
		}

		${HEADER} > :not(h1) button * {
			font-size: inherit !important;
			font-weight: inherit !important;
			line-height: 1;
		}

		${HEADER} > :not(h1) button svg {
			width: 16px !important;
			height: 16px !important;
		}

		[${BACK_ATTR}] {
			gap: var(--abt-space-2);
			align-items: center;
			padding: 0 var(--abt-space-4) 0 var(--abt-space-3) !important;
		}

		[${BACK_ATTR}] > svg {
			display: none !important;
		}

		/* A thin chevron in place of the theme's heavy one. */
		[${BACK_ATTR}]::before {
			content: "";
			width: 8px;
			height: 13px;
			background: currentColor;
			-webkit-mask: ${CHEVRON_LEFT} center / contain no-repeat;
			mask: ${CHEVRON_LEFT} center / contain no-repeat;
		}

		${MONTH} * {
			text-decoration: none !important;
		}

		${MONTH}::after {
			content: "";
			width: 12px;
			height: 12px;
			margin-left: var(--abt-space-2);
			background: currentColor;
			-webkit-mask: ${CHEVRON_DOWN} center / contain no-repeat;
			mask: ${CHEVRON_DOWN} center / contain no-repeat;
			opacity: 0.6;
		}
	`,
	init: () => {
		const stop = watchDom(markHeaders);
		return () => {
			stop();
			for (const el of document.querySelectorAll(`${HEADER}, [${BACK_ATTR}]`)) {
				el.removeAttribute(HEADER_ATTR);
				el.removeAttribute(BACK_ATTR);
			}
		};
	},
});
