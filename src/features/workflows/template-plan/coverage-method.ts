import { defineSetting } from "@features/types";
import { templatePlanState } from "./state.svelte";

export const nextMonthCoverageMethod = defineSetting({
	type: "select",
	label: "Next Month Coverage Method",
	description: "Choose the target used by Next Month Coverage in Plan → Overview.",
	icon: "layout",
	context: {
		key: "next-month-coverage-method",
		defaultValue: "goal-templates",
	},
	options: [
		{ value: "spending-average", label: "Recent average spending" },
		{ value: "goal-templates", label: "Goal templates" },
	],
	init: ({ value }) => {
		templatePlanState.coverageMethod =
			value === "spending-average" ? "spending-average" : "goal-templates";
	},
});
