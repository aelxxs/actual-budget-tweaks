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
	css: (ctx) => `
		.css-w4wco7,
		.css-eiyo5a {
			width: 100%;
			height: 100%;
			transition: box-shadow 0.25s;
			background-color: var(--ctp-crust);
		}
	`,
});
