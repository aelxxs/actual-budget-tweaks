import { defineSetting } from "@features/types";

export const notificationContrast = defineSetting({
	type: "checkbox",
	label: "Improve Notification Contrast",
	description: "Darker text on notification banners for readability.",
	group: "General",
	icon: "eye",
	context: {
		key: "actual-notification-contrast",
		defaultValue: true,
	},
	// The theme pairs --color-noticeBackground (light teal) with
	// --color-noticeText (light), producing unreadable success
	// notifications and "Paid" status badges. Force a dark notice
	// text wherever the variable resolves on a noticeBackground.
	css: () => `
		:root {
			--color-noticeText: #11111b !important;
		}
	`,
});
