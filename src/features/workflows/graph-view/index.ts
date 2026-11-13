import { addNativeNavLink, followOverlayPage, openOverlayPage } from "@features/core/overlay-page";
import { NAV_BORDER_CSS } from "@features/layout/borders";
import { defineSetting } from "@features/types";
import { icon } from "@lib/utilities/icons";
import { Page } from "@lib/utilities/pages";
import GraphView from "./GraphView.svelte";

export function openGraphView(): void {
	openOverlayPage(Page.Graph, GraphView);
}

/** Experimental: a page of how money moves between accounts, payees and categories. */
export const graphView = defineSetting({
	type: "checkbox",
	label: "Graph view",
	description:
		"Experimental: a page showing how your accounts, payees and categories connect. May change or be removed.",
	icon: "network",
	context: {
		key: "graph-view",
		defaultValue: false,
	},
	css: () => NAV_BORDER_CSS,
	init: () => {
		const stopFollowing = followOverlayPage(Page.Graph, openGraphView);
		const removeLink = addNativeNavLink({
			attr: "data-abt-graph-link",
			label: "Graph",
			iconSvg: icon("network", { size: 15 }),
			page: Page.Graph,
			open: openGraphView,
		});
		return () => {
			removeLink();
			stopFollowing();
		};
	},
});
