import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

const TOGGLE_ATTR = "data-abt-cti";

function applyAttribute(enabled: boolean) {
	document.documentElement.setAttribute(TOGGLE_ATTR, enabled ? "on" : "off");
}

export const categoryTemplateInsights = defineSetting({
	type: "checkbox",
	label: "Category Template Insights",
	context: {
		key: "actual-category-template-insights",
		defaultValue: true,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		applyAttribute(Boolean(enabled));
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		applyAttribute(Boolean(value));
	},
});
