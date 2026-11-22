import { desktopOnly } from "@lib/actual/pages";

/** Set on a header the bridge recognised, to the column it sorts. */
export const COLUMN_ATTR = "data-abt-sort-column";
/** Set on the header the list is sorted by, to its direction. */
export const DIR_ATTR = "data-abt-sort-dir";
export const ARROW_ATTR = "data-abt-sort-arrow";

export const SCHEDULE_SORT_CSS = desktopOnly(`
	[${COLUMN_ATTR}] {
		cursor: pointer;
		user-select: none;
	}

	[${COLUMN_ATTR}]:focus-visible {
		outline: 2px solid var(--abt-accent-4);
		outline-offset: -2px;
	}

	/* Actual stacks a header's label in a column; the arrow sits beside it. */
	[${COLUMN_ATTR}] > div:first-of-type {
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: var(--abt-space-1);
	}

	[${COLUMN_ATTR}] > div:first-of-type > span {
		min-width: 0;
	}

	[${ARROW_ATTR}] {
		display: inline-flex;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.15s, transform 0.15s;
	}

	[${COLUMN_ATTR}]:hover [${ARROW_ATTR}] {
		opacity: 0.4;
	}

	[${DIR_ATTR}] [${ARROW_ATTR}] {
		opacity: 1;
		color: var(--abt-accent);
	}

	/* Drawn pointing down; up for ascending. */
	[${DIR_ATTR}="asc"] [${ARROW_ATTR}] {
		transform: rotate(180deg);
	}
`);
