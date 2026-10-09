import { defineSetting } from "@features/types";

// --abt-ink-5 is redeclared in the live sidebar and popovers, so each scroller tints for its surface.
// No !important: scrollers that hide their bar (scrollbar-width: none) keep it hidden.
const CSS = `
	* {
		scrollbar-width: thin;
		scrollbar-color: var(--abt-ink-5) transparent;
	}
`;

export const themedScrollbars = defineSetting({
	type: "checkbox",
	label: "Themed Scrollbars",
	description: "Thin scrollbars tinted to match the theme.",
	group: "General",
	icon: "sliders",
	context: {
		key: "themed-scrollbars",
		defaultValue: true,
	},
	css: () => CSS,
});
