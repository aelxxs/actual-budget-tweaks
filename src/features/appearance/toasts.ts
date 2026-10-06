import { defineSetting } from "@features/types";

/*
 * Adapter CSS for Actual's notification toasts. role="alert" is unique to them; the card is its
 * child, the close button the card's first button. Actual colours the wrapper's text by kind
 * (success, error, warning), so the card's currentColor carries the kind's accent.
 */
const TOAST = '[role="alert"]';
const CARD = `${TOAST} > div`;
const CLOSE = `${CARD} > button:first-child`;
const CONTENT = `${CARD} > div`;
const ACTION = `${CONTENT} button`;

const CSS = `
	${CARD} {
		max-width: 400px !important;
		padding: var(--abt-space-4) 40px var(--abt-space-4) var(--abt-space-5) !important;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, currentColor 22%, transparent) !important;
		border-radius: 10px !important;
		background: color-mix(in srgb, currentColor 7%, var(--color-tableBackground)) !important;
		box-shadow:
			0 10px 30px rgba(0, 0, 0, 0.28),
			0 2px 6px rgba(0, 0, 0, 0.12) !important;
		font-size: 13px !important;
		line-height: 1.45;
	}

	${CARD}::before {
		content: "";
		position: absolute;
		inset: 0 auto 0 0;
		width: 3px;
		background: currentColor;
	}

	${CONTENT} {
		gap: var(--abt-space-2) !important;
	}

	${CONTENT} > div {
		color: var(--color-pageText);
	}

	${CONTENT} div {
		font-size: inherit !important;
	}

	/* The message row: text and action button share a centre line, button or not. */
	${CONTENT} > div:has(> div:first-child > div) {
		min-height: 26px;
		align-items: center !important;
	}

	/* Actual centres the message in its column, which floats short ones mid-card. */
	${CONTENT} > div > div:first-child > div {
		align-items: flex-start !important;
	}

	/* The title is the only text-only row; it keeps the kind's colour. */
	${CONTENT} > div:first-child:not(:has(div)) {
		color: inherit;
		font-weight: 600 !important;
	}

	${CLOSE} {
		top: 10px !important;
		right: var(--abt-space-3) !important;
		width: 24px;
		height: 24px;
		padding: 0 !important;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--abt-radius);
		color: var(--abt-muted) !important;
		opacity: 1 !important;
	}

	/* Without a title, centred on the message row. */
	${CARD}:has(> div > div:first-child > div:first-child > div) > button:first-child {
		top: 13px !important;
	}

	${CLOSE}:hover {
		background: var(--abt-fill-hover) !important;
		color: var(--color-pageText) !important;
	}

	${ACTION} {
		height: 26px;
		padding: 0 var(--abt-space-4) !important;
		border-radius: 999px !important;
		font-size: var(--abt-text-sm) !important;
		font-weight: 500;
		align-self: center;
	}

	${ACTION}[data-hovered],
	${ACTION}[data-pressed] {
		background: var(--abt-fill-hover) !important;
	}
`;

export const modernToasts = defineSetting({
	type: "checkbox",
	label: "Modern Toasts",
	description: "Restyles notifications as compact cards with a coloured accent.",
	group: "General",
	icon: "layout",
	context: {
		key: "modern-toasts",
		defaultValue: true,
	},
	css: () => CSS,
});
