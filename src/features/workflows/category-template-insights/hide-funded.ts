import { defineSetting } from "@features/types";
import { STATE_ATTR } from ".";

const FUNDED = `[${STATE_ATTR}="full"], [${STATE_ATTR}="paid"]`;

export const hideFundedTemplateBars = defineSetting({
	type: "checkbox",
	label: "Quiet Funded Bars",
	description:
		"Leave fully funded categories as an empty track, so the ones still needing money stand out.",
	icon: "eyeOff",
	group: "Budget",
	context: {
		key: "cti-hide-funded",
		defaultValue: false,
	},
	css: () => `
		:is(${FUNDED}) .abt-cti-bar::after {
			display: none;
		}
	`,
});
