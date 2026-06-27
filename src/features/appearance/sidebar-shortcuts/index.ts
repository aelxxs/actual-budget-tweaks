import { defineSetting } from "@features/types";
import { getValue, setValue } from "@lib/utilities/store";
import { mount, unmount } from "svelte";
import ShortcutsBar from "./ShortcutsBar.svelte";

const BAR_ATTR = "data-abt-shortcuts-bar";

let observer: MutationObserver | null = null;
let scheduled = false;
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

function scheduleRender(): void {
	if (scheduled) return;
	scheduled = true;
	requestAnimationFrame(() => {
		scheduled = false;
		renderBar();
	});
}

export const sidebarShortcuts = defineSetting({
	type: "checkbox",
	label: "Sidebar Shortcuts",
	context: {
		key: "sidebar-shortcuts-enabled",
		defaultValue: false,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (!enabled) return;

		function tryRender() {
			if (document.querySelector('a[href="/budget"]')) {
				renderBar();
			} else {
				setTimeout(tryRender, 500);
			}
		}
		tryRender();

		observer = new MutationObserver(() => {
			if (!document.querySelector(`[${BAR_ATTR}]`) && document.querySelector('a[href="/budget"]')) {
				scheduleRender();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (value) {
			renderBar();
			if (!observer) {
				observer = new MutationObserver(() => {
					if (!document.querySelector(`[${BAR_ATTR}]`) && document.querySelector('a[href="/budget"]')) {
						scheduleRender();
					}
				});
				observer.observe(document.body, { childList: true, subtree: true });
			}
		} else {
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			cleanup();
		}
	},
});
