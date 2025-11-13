import { defineSetting } from "./types";

export const imageWidgets = defineSetting({
	type: "checkbox",
	label: "Show Images in Report Widgets",
	context: {
		key: "image-widgets",
		defaultValue: true,
	},
	init: () => {},
	onChange: () => {},
});
