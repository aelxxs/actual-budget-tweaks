import { defineSetting } from "@features/types";

/** Read by the live sidebar, which lists the accounts itself. */
export const sidebarClosedAccounts = defineSetting({
	type: "checkbox",
	label: "Show closed accounts",
	description: "Lists closed accounts in their own section at the bottom.",
	group: "Sidebar",
	icon: "eyeOff",
	context: {
		key: "sidebar-show-closed",
		defaultValue: true,
	},
});
