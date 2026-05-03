import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { defineSetting } from "./types";

export const notificationContrast = defineSetting({
	type: "checkbox",
	label: "Improve Notification Contrast",
	context: {
		key: "actual-notification-contrast",
		defaultValue: true,
		// The theme pairs --color-noticeBackground (light teal) with
		// --color-noticeText (light), producing unreadable success
		// notifications and "Paid" status badges. Force a dark notice
		// text wherever the variable resolves on a noticeBackground.
		css: `
			:root {
				--color-noticeText: #11111b !important;
			}
		`,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		applyGlobalCSS(enabled ? ctx.css : "", ctx.key);
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		applyGlobalCSS(value ? ctx.css : "", ctx.key);
	},
});
