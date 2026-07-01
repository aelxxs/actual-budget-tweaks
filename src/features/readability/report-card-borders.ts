import { defineSetting } from "@features/types";

export const reportCardBorders = defineSetting({
	type: "checkbox",
	label: "Report Card Borders",
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
