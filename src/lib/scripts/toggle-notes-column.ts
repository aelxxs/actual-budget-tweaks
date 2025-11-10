import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { SelectSetting } from "./types";

export const toggleNotesColumn: SelectSetting = {
	type: "select",
	label: "Notes Visibility",
	options: [
		{ value: "block", label: "Visible (Default)" },
		{ value: "none", label: "Hidden" },
	],
	context: {
		key: "notes-option",
		defaultValue: "block",
		cssVar: "--notes-visibility",
	},
	init: async (ctx) => {
		applyGlobalCSS(
			`
		[data-testid="notes"] {
			display: var(${ctx.cssVar}) !important;
		}`,
			"notes-css"
		);

		const value = await getValue(ctx.key, ctx.defaultValue);
		document.documentElement.style.setProperty(ctx.cssVar, value);
	},
	onChange: async (val, ctx) => {
		await setValue(ctx.key, val);
		document.documentElement.style.setProperty(ctx.cssVar, val);
	},
};
