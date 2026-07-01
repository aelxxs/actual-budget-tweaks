import { defineSetting } from "@features/types";

export const reportWidgetBackgroundColor = defineSetting({
	type: "select",
	label: "Report Card Color",
	options: [
		{ label: "Light (Default)", value: "var(--color-tableBackground)" },
		{ label: "Dark", value: "var(--ctp-crust)" },
	],
	context: {
		key: "report-card-color",
		defaultValue: "var(--color-tableBackground)",
	},
	css: (ctx) => `
		.css-w4wco7,
		.css-eiyo5a {
			width: 100%;
			height: 100%;
			transition: box-shadow 0.25s;
			background-color: ${ctx.value};
		}
	`,
});
