import { defineSetting } from "@features/types";

export const headerBorder = defineSetting({
	type: "checkbox",
	label: "Header Border",
	context: {
		key: "header-border",
		defaultValue: true,
	},
	css: () => `
		.css-pq65pe {
			border-bottom: var(--border);
		}
		.abt-side-drawer-sidebar {
			border-top: none;
			border-top-left-radius: 0px;
		}
	`,
});
