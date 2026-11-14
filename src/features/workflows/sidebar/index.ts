import { defineSetting } from "@features/types";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import LayoutPicker from "./LayoutPicker.svelte";
import { syncWindowColor } from "@features/theme/theme-apply";
import { LIVE_SIDEBAR_ATTR, SIDEBAR_MOUNT_ATTR as MOUNT_ATTR } from "./lib/collapse";
import { NATIVE_ROOT_ATTR } from "./lib/data";
import { LAYOUT_KEY } from "./lib/layout";
import { NATIVE_ICON_ATTR, NAV_ICON_ATTR, swapSettingsNavIcons } from "./lib/settings-nav-icons";
import Sidebar from "./Sidebar.svelte";
import { findNativeSidebarRoot } from "@lib/actual/native-ui";
import { SIDEBAR_MENU } from "@lib/actual-dom";

const WRAP_ATTR = "data-abt-live-sidebar-wrap";

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
	/* With Actual's sidebar unpinned its wrapper slides off-screen, and its pin is in the hidden
	   native sidebar; the live sidebar collapses on its own, so the wrapper stays docked. */
	[${WRAP_ATTR}] {
		position: relative !important;
		inset: auto !important;
		transform: none !important;
		box-shadow: none !important;
		border-radius: 0 !important;
		transition: none !important;
	}
	${SIDEBAR_MENU} {
		display: none !important;
	}
	[${NATIVE_ICON_ATTR}] {
		display: none !important;
	}
	[${NAV_ICON_ATTR}] {
		display: contents;
	}
`;

export const experimentalSidebar = defineSetting({
	type: "checkbox",
	label: "Live sidebar",
	description:
		"Replaces Actual's sidebar with one that has live balances, account groups and shortcuts.",
	group: "Sidebar",
	writes:
		"Renames an account, runs its bank sync, or edits account groups when you do so from the sidebar.",
	context: {
		key: "experimental-sidebar",
		defaultValue: true,
	},
	css: () => CSS,
	init: () => {
		let sidebar: Mounted | null = null;
		document.documentElement.setAttribute(LIVE_SIDEBAR_ATTR, "");
		syncWindowColor();

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
		const unswapIcons = swapSettingsNavIcons();

		return () => {
			unwatch();
			unswapIcons();
			document.querySelector(`[${NATIVE_ROOT_ATTR}]`)?.removeAttribute(NATIVE_ROOT_ATTR);
			document.querySelector(`[${WRAP_ATTR}]`)?.removeAttribute(WRAP_ATTR);
			sidebar?.destroy();
			sidebar = null;
			document.documentElement.removeAttribute(LIVE_SIDEBAR_ATTR);
			syncWindowColor();
		};
	},
});

export const experimentalSidebarLayout = defineSetting({
	type: "custom",
	label: "Live sidebar layout",
	description: "A standard sidebar, or an icon bar with a separate accounts panel.",
	group: "Sidebar",
	context: {
		key: LAYOUT_KEY,
		defaultValue: "split",
	},
	component: LayoutPicker,
	init: () => {},
	// The sidebar watches this key itself.
	apply: () => {},
});
