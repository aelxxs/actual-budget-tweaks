import { defineSetting } from "@features/types";
import { HELP_BUTTON } from "@lib/actual-dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import ThemeMenu from "./ThemeMenu.svelte";

const HOST_ATTR = "data-abt-theme-menu";

export const themeMenu = defineSetting({
	type: "checkbox",
	label: "Theme Menu",
	description: "A palette button in the top bar to change theme, edit style or open Theme Studio.",
	group: "General",
	icon: "palette",
	context: {
		key: "theme-menu",
		defaultValue: true,
	},
	init: () => {
		let host: HTMLDivElement | null = null;
		let menu: Mounted | null = null;

		const unwatch = watchDom(() => {
			const bar = document.querySelector(HELP_BUTTON)?.parentElement?.parentElement ?? null;
			if (!bar) {
				return;
			}
			if (!host) {
				host = document.createElement("div");
				host.setAttribute(HOST_ATTR, "");
				// The Modern Titlebar orders the bell and Help after its divider; this joins them, last.
				Object.assign(host.style, { display: "flex", order: "2" });
				menu = mountToNodeWithReturn(ThemeMenu, {}, host);
			}
			// Last in the row, after Help.
			if (bar.lastElementChild !== host) {
				bar.appendChild(host);
			}
		});

		return () => {
			unwatch();
			menu?.destroy();
			host?.remove();
		};
	},
});
