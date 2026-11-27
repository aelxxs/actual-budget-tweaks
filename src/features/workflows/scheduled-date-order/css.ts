import { desktopOnly } from "@lib/actual/pages";

/** The toggle ABT adds to the transaction table's Date header. */
export const TOGGLE_ATTR = "data-abt-scheduled-order";

export const SCHEDULED_ORDER_CSS = desktopOnly(`
	[${TOGGLE_ATTR}] {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		margin-left: var(--abt-space-1);
		padding: 2px; /* raw: hit area around a 12px glyph */
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		opacity: 0.45;
		cursor: pointer;
		transition: opacity 0.15s, color 0.15s;
	}

	[${TOGGLE_ATTR}]:hover {
		opacity: 1;
	}

	[${TOGGLE_ATTR}]:focus-visible {
		outline: 2px solid var(--abt-accent-4);
		outline-offset: 0;
		opacity: 1;
	}

	[${TOGGLE_ATTR}][aria-pressed="true"] {
		opacity: 1;
		color: var(--abt-accent);
	}
`);
