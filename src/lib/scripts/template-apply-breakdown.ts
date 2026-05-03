import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

const TOGGLE_ATTR = "data-abt-tab";

function applyAttribute(enabled: boolean) {
	document.documentElement.setAttribute(TOGGLE_ATTR, enabled ? "on" : "off");
}

export const templateApplyBreakdown = defineSetting({
	type: "checkbox",
	label: "Template Apply Breakdown",
	context: {
		key: "actual-template-apply-breakdown",
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
