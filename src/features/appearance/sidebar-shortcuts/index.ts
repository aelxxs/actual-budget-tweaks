import { defineSetting } from "@features/types";

/** Read by the live sidebar, which mounts the shortcuts bar itself. */
export const sidebarShortcuts = defineSetting({
	type: "checkbox",
	label: "Sidebar shortcuts",
	description: "Pins links and tools to the sidebar.",
	group: "Sidebar",
	icon: "star",
	context: {
		key: "sidebar-shortcuts-enabled",
		defaultValue: false,
	},
});

/** Shown only in the Customize sidebar panel; the bar reads it directly. */
export const sidebarShortcutsAddTile = defineSetting({
	type: "checkbox",
	label: "Show add tile",
	description: "Keeps a + tile at the end of the bar for adding shortcuts.",
	icon: "square",
	context: {
		key: "sidebar-shortcuts-add-tile",
		defaultValue: true,
	},
});
