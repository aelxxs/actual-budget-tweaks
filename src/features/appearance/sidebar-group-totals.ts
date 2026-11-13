import { defineSetting } from "@features/types";

/** Read by the live sidebar, which draws the group headers itself. */
export const sidebarGroupTotals = defineSetting({
	type: "checkbox",
	label: "Account group totals",
	description: "Shows each group's combined balance beside its name.",
	group: "Sidebar",
	icon: "calculator",
	context: {
		key: "sidebar-group-totals",
		defaultValue: false,
	},
});
