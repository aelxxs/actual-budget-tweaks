import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import ThemeMenu from "./ThemeMenu.svelte";

// The palette button the Titlebar setting adds.
export function mountThemeMenu(): { host: HTMLElement; destroy: () => void } {
	const host = document.createElement("div");
	host.setAttribute("data-abt-theme-menu", "");
	// The titlebar orders the bell and Help after its divider; this joins them.
	Object.assign(host.style, { display: "flex", order: "2" });
	const menu = mountToNodeWithReturn(ThemeMenu, {}, host);
	return {
		host,
		destroy: () => {
			menu.destroy();
			host.remove();
		},
	};
}
