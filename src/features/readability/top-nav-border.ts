import { defineSetting } from "@features/types";

export const headerBorder = defineSetting({
	type: "checkbox",
	label: "Header Border",
	description: "Add a border under the top navigation bar.",
	group: "General",
	icon: "square",
	context: {
		key: "header-border",
		defaultValue: true,
	},
	css: () => `
		[data-abt-content-grid] > div:nth-child(1) {
			border-bottom: 1px solid var(--abt-panel-border);
		}
		.abt-side-drawer-sidebar {
			border-top: none;
			border-top-left-radius: 0px;
		}
	`,
});
