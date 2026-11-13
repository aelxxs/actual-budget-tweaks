import { defineSetting } from "@features/types";
import CustomizeButton from "./components/CustomizeButton.svelte";

/** The settings page's way into the sidebar's Customize panel, where its options live. */
export const customizeSidebarEntry = defineSetting({
	type: "custom",
	label: "Customize sidebar",
	description: "Opens the sidebar's layout, density, search and shortcut settings.",
	group: "Sidebar",
	icon: "sliders",
	context: {
		key: "customize-sidebar-entry",
		defaultValue: null,
	},
	bare: true,
	component: CustomizeButton,
	init: () => {},
});
