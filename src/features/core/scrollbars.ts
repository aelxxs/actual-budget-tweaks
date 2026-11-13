import { applyGlobalCSS } from "@lib/dom/dom";

// The colour inherits, so it's set only where ui.css redeclares --abt-ink-5, not resolved on every
// element. No !important: scrollers that hide their bar keep it hidden.
const CSS = `
	:root,
	.sidebar,
	.abt-popover {
		scrollbar-color: var(--abt-ink-5) transparent;
	}

	* {
		scrollbar-width: thin;
	}
`;

/** Thin scrollbars in the theme's colors, always: Actual's own show black on dark surfaces. */
export const scrollbars = {
	type: "core" as const,
	init: () => applyGlobalCSS(CSS, "scrollbars"),
};
