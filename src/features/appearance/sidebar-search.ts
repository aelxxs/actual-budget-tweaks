import { defineSetting } from "@features/types";

/** Read by the live sidebar, which draws the search button itself. */
export const sidebarSearch = defineSetting({
	type: "checkbox",
	label: "Sidebar Search Bar",
	description: "Quickly filter accounts, categories, and pages.",
	group: "Sidebar",
	icon: "search",
	context: {
		key: "sidebar-search-enabled",
		defaultValue: true,
	},
});
