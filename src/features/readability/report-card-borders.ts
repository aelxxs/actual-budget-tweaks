import { defineSetting } from "@features/types";
import ReportCardBordersPreview from "./previews/ReportCardBorders.svelte";

export const reportCardBorders = defineSetting({
	type: "checkbox",
	label: "Report Card Borders",
	description: "Add borders around widget cards on the Reports page.",
	group: "Reports",
	icon: "square",
	preview: ReportCardBordersPreview,
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
