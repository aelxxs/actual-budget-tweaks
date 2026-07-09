import { defineSetting } from "@features/types";

export const reportCardBorders = defineSetting({
	type: "checkbox",
	label: "Report Card Borders",
	description: "Add borders around widget cards on the Reports page.",
	group: "Reports",
	icon: "square",
	context: {
		key: "report-card-borders",
		defaultValue: true,
	},
	css: () => `
		.react-grid-item {
			border: var(--border);
		}
	`,
});
