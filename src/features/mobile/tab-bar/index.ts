import { defineSetting } from "@features/types";
import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import TabBar from "./TabBar.svelte";
import { MOBILE_NAV } from "@lib/actual-dom";

export const mobileTabBar = defineSetting({
	type: "checkbox",
	label: "Tab bar",
	description: "Replaces the slide-up menu with a tab bar, and puts the other pages under More.",
	group: "Mobile",
	icon: "smartphone",
	platform: "mobile",
	context: {
		key: "mobile-tab-bar",
		defaultValue: false,
	},
	css: () => `
		${MOBILE_NAV} {
			display: none !important;
		}
	`,
	init: () => {
		const bar = mountToNodeWithReturn(TabBar, {});
		document.body.appendChild(bar.node);
		return bar.destroy;
	},
});
