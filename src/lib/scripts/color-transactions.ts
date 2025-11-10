import { CheckboxSetting } from "./types";

export const colorTransactions: CheckboxSetting = {
	type: "checkbox",
	label: "Color Transactions",
	context: {
		key: "actual-amountcolors",
		defaultValue: true,
	},
};
