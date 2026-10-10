import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import LayoutPicker from "./LayoutPicker.svelte";
import { SIDEBAR_MOUNT_ATTR as MOUNT_ATTR } from "./lib/collapse";
import { NATIVE_ROOT_ATTR } from "./lib/data";
import { LAYOUT_KEY } from "./lib/layout";
import Sidebar from "./Sidebar.svelte";

const WRAP_ATTR = "data-abt-live-sidebar-wrap";

function findNativeSidebarRoot(): HTMLElement | null {
	const anchor = document.querySelector('[data-testid="sidebar-all-accounts-balance"]');
	let el = anchor?.parentElement ?? null;
	while (el) {
		if (el.style.flexShrink === "0" && el.style.minWidth) {
			return el;
		}
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
	[${WRAP_ATTR}] {
		overflow: visible !important;
	}
`;

export const experimentalSidebar = defineSetting({
	type: "checkbox",
	label: "Live sidebar",
	description:
		"ABT's sidebar, with live balances, account groups, search and shortcuts. Off shows Actual's own.",
	group: "Sidebar",
	writes: "Renames an account or runs its bank sync when you do so from the sidebar.",
	context: {
		key: "experimental-sidebar",
		defaultValue: true,
	},
	css: () => CSS,
	init: () => {
		let sidebar: Mounted | null = null;

		const sync = () => {
			const native = findNativeSidebarRoot();
			if (!native) {
				return;
			}
			native.setAttribute(NATIVE_ROOT_ATTR, "1");
			native.parentElement?.setAttribute(WRAP_ATTR, "");

			if (sidebar && document.querySelector(`[${MOUNT_ATTR}]`)) {
				return;
			}

			sidebar = mountToNodeWithReturn(Sidebar, {});
			sidebar.node.setAttribute(MOUNT_ATTR, "1");
			native.parentElement?.insertBefore(sidebar.node, native);
		};

		const unwatch = watchDom(sync);

		return () => {
			unwatch();
			document.querySelector(`[${NATIVE_ROOT_ATTR}]`)?.removeAttribute(NATIVE_ROOT_ATTR);
			document.querySelector(`[${WRAP_ATTR}]`)?.removeAttribute(WRAP_ATTR);
			sidebar?.destroy();
			sidebar = null;
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
