import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import { unmount } from "svelte";
import LayoutPicker from "./LayoutPicker.svelte";
import { SIDEBAR_MOUNT_ATTR as MOUNT_ATTR } from "./lib/collapse";
import { NATIVE_ROOT_ATTR } from "./lib/data";
import { LAYOUT_KEY } from "./lib/layout";
import Sidebar from "./Sidebar.svelte";

function findNativeSidebarRoot(): HTMLElement | null {
	const anchor = document.querySelector('[data-testid="sidebar-all-accounts-balance"]');
	let el = anchor?.parentElement ?? null;
	while (el) {
		if (el.style.flexShrink === "0" && el.style.minWidth) return el;
		el = el.parentElement;
	}
	return null;
}

// No fixed width here — Sidebar.svelte's own `.sidebar` root manages its width
// (resizable, collapsible) via inline style. This wrapper just needs to be a
// non-shrinking flex child and let its content size it.
const CSS = `
	[${NATIVE_ROOT_ATTR}] {
		display: none !important;
	}
	[${MOUNT_ATTR}] {
		display: flex;
		height: 100%;
		flex-shrink: 0;
	}
	/* Actual's sidebar wrapper clips at the sidebar's edge; let the resize grip straddle it.
	   Its own z-index (above the titlebar) already keeps the grip over the page. */
	:has(> [${MOUNT_ATTR}]) {
		overflow: visible !important;
	}
`;

export const experimentalSidebar = defineSetting({
	type: "checkbox",
	label: "Live sidebar (experimental)",
	description: "Replace the native sidebar with a rebuilt one wired to live account data.",
	group: "Sidebar",
	context: {
		key: "experimental-sidebar",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		let instance: unknown = null;

		const sync = () => {
			const native = findNativeSidebarRoot();
			if (!native) return;
			native.setAttribute(NATIVE_ROOT_ATTR, "1");

			if (instance && document.querySelector(`[${MOUNT_ATTR}]`)) return;

			const mounted = mountToNodeWithReturn(Sidebar, {});
			mounted.node.setAttribute(MOUNT_ATTR, "1");
			instance = mounted.instance;
			native.parentElement?.insertBefore(mounted.node, native);
		};

		const unwatch = watchDom(sync);

		return () => {
			unwatch();
			document.querySelector(`[${MOUNT_ATTR}]`)?.remove();
			document.querySelector(`[${NATIVE_ROOT_ATTR}]`)?.removeAttribute(NATIVE_ROOT_ATTR);
			if (instance) unmount(instance);
			instance = null;
		};
	},
});

export const experimentalSidebarLayout = defineSetting({
	type: "custom",
	label: "Live sidebar layout",
	description:
		"Standard sidebar, or an icon bar with a separate accounts panel. Applies when the live sidebar is on.",
	group: "Sidebar",
	context: {
		key: LAYOUT_KEY,
		defaultValue: "split",
	},
	component: LayoutPicker,
	init: () => {},
});
