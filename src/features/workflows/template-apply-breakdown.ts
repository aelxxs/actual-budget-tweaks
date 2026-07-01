import { defineSetting } from "@features/types";

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
	init: (ctx) => {
		applyAttribute(Boolean(ctx.value));

		return () => {
			applyAttribute(false);
		};
	},
});
