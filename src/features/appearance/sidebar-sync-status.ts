import { defineSetting } from "@features/types";

/** Read by the live sidebar, which draws the account rows itself. */
export const sidebarSyncStatus = defineSetting({
	type: "checkbox",
	label: "Sync status",
	description: "Shows each account's bank sync status beside its name.",
	group: "Sidebar",
	icon: "refreshCw",
	context: {
		key: "sidebar-sync-status",
		defaultValue: true,
	},
});
