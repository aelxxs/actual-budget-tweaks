import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const toggleNotesColumn = defineSetting({
	type: "select",
	label: "Notes Visibility",
	options: [
		{ value: "block", label: "Visible (Default)" },
		{ value: "none", label: "Hidden" },
	],
	context: {
		key: "notes-visibility",
		defaultValue: "block",
		css: `
			[data-testid="notes"] {
				display: var(--notes-visibility) !important;
			}
		`,
		variable: "--notes-visibility",
	},
	init: async (ctx) => {
		applyGlobalCSS(ctx.css, ctx.key);

		const value = await getValue(ctx.key, ctx.defaultValue);
		document.documentElement.style.setProperty(ctx.variable, value);
	},
	onChange: async (val, ctx) => {
		await setValue(ctx.key, val);
		document.documentElement.style.setProperty(ctx.variable, val);
	},
});
