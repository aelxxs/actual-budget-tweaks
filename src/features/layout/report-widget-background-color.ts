import { defineSetting } from "@features/types";

export const reportWidgetBackgroundColor = defineSetting({
	type: "checkbox",
	label: "Dark Report Cards",
	description: "Use a darker background for widget cards on the Reports page.",
	group: "Reports",
	icon: "palette",
	context: {
		key: "report-card-color-dark",
		defaultValue: false,
	},
	css: () => `
		.react-grid-item > div > div,
		.react-grid-item > div > button > div {
			width: 100%;
			height: 100%;
			transition: box-shadow 0.25s;
			background-color: var(--ctp-crust, var(--color-pageBackground));
		}
	`,
});
