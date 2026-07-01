import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { mount, unmount } from "svelte";
import ShortcutsBar from "./ShortcutsBar.svelte";

const BAR_ATTR = "data-abt-shortcuts-bar";

let barInstance: ReturnType<typeof mount> | null = null;
let barContainer: HTMLElement | null = null;

function findInsertionPoint(): HTMLElement | null {
	const budgetLink = document.querySelector('a[href="/budget"]');
	if (!budgetLink) return null;

	let navContainer = budgetLink.parentElement;
	while (navContainer) {
		if (navContainer.querySelector('a[href="/reports"]') && navContainer.querySelector('a[href="/schedules"]')) {
			return navContainer;
		}
		navContainer = navContainer.parentElement;
	}
	return null;
}

function renderBar(): void {
	const nav = findInsertionPoint();
	if (!nav) return;

	if (barContainer && barContainer.parentElement) return;

	cleanup();

	barContainer = document.createElement("div");
	barContainer.setAttribute(BAR_ATTR, "1");

	barInstance = mount(ShortcutsBar, { target: barContainer });

	nav.parentElement?.insertBefore(barContainer, nav.nextSibling);
}

function cleanup(): void {
	if (barInstance) {
		unmount(barInstance);
		barInstance = null;
	}
	if (barContainer) {
		barContainer.remove();
		barContainer = null;
	}
}

export const sidebarShortcuts = defineSetting({
	type: "checkbox",
	label: "Sidebar Shortcuts",
	context: {
		key: "sidebar-shortcuts-enabled",
		defaultValue: false,
	},
	init: () => {
		const unwatch = watchDom(renderBar);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
