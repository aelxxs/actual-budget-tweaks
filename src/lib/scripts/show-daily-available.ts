import { CheckboxSetting } from "./types";

export const showDailyAvailable: CheckboxSetting = {
	type: "checkbox",
	label: "Show Daily Available",
	context: {
		key: "actual-daily",
		defaultValue: true,
	},
};
