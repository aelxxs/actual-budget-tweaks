import { watchDom } from "@lib/dom/dom-watcher";
import { isMobileView } from "@lib/actual/pages";
import { settingsNav } from "@lib/actual/settings-page";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import NavIcon from "../components/NavIcon.svelte";
import { settingsNavIcons } from "./nav";
import { SETTINGS_PAGE_LINK } from "@lib/actual-dom";

export const NATIVE_ICON_ATTR = "data-abt-native-icon";
export const NAV_ICON_ATTR = "data-abt-nav-icon";

const mounted = new Map<HTMLAnchorElement, Mounted>();

function sync(): void {
	const nav = isMobileView() ? null : settingsNav();
	for (const [link, icon] of mounted) {
		if (!link.isConnected || !link.contains(icon.node)) {
			icon.destroy();
			mounted.delete(link);
		}
	}
	if (!nav) {
		return;
	}
	for (const link of nav.querySelectorAll<HTMLAnchorElement>(`:scope > ${SETTINGS_PAGE_LINK}`)) {
		const native = link.querySelector(":scope > svg");
		const icon = settingsNavIcons[link.pathname.split("/").pop() ?? ""];
		if (!native || !icon || mounted.has(link)) {
			continue;
		}
		const swap = mountToNodeWithReturn(NavIcon, { icon });
		swap.node.setAttribute(NAV_ICON_ATTR, "");
		native.setAttribute(NATIVE_ICON_ATTR, "");
		link.insertBefore(swap.node, native);
		mounted.set(link, swap);
	}
}

/** The Live sidebar's icons in Actual's settings nav, so the two navs match. */
export function swapSettingsNavIcons(): () => void {
	const unwatch = watchDom(sync);
	return () => {
		unwatch();
		for (const icon of mounted.values()) {
			icon.destroy();
		}
		mounted.clear();
		for (const native of document.querySelectorAll(`[${NATIVE_ICON_ATTR}]`)) {
			native.removeAttribute(NATIVE_ICON_ATTR);
		}
	};
}
