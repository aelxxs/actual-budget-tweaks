import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";

const BAR_ATTR = "data-abt-search-bar";

const CSS = /* css */ `
	[${BAR_ATTR}] {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 10px 4px;
		padding: 8px 10px;
		border-radius: var(--border-radius);
		background: color-mix(in srgb, var(--color-sidebarItemText) 8%, transparent);
		cursor: pointer;
		transition: background 0.1s;
		flex-shrink: 0;
	}

	[${BAR_ATTR}]:hover {
		background: color-mix(in srgb, var(--color-sidebarItemText) 14%, transparent);
	}

	[${BAR_ATTR}] .search-icon {
		opacity: 0.4;
		flex-shrink: 0;
	}

	[${BAR_ATTR}] .search-text {
		font-size: 12px;
		color: var(--color-sidebarItemText);
		opacity: 0.4;
		flex: 1;
	}

	[${BAR_ATTR}] .search-kbd {
		font-size: 9px;
		font-family: inherit;
		color: var(--color-sidebarItemText);
		opacity: 0.3;
		border: 1px solid color-mix(in srgb, var(--color-sidebarItemText) 15%, transparent);
		border-radius: 4px;
		padding: 1px 5px;
		line-height: 1.4;
	}
`;

function isMac(): boolean {
	return navigator.platform?.includes("Mac") ?? navigator.userAgent.includes("Mac");
}

function renderBar(): void {
	if (document.querySelector(`[${BAR_ATTR}]`)) return;

	const budgetLink = document.querySelector('a[href="/budget"]');
	if (!budgetLink) return;

	let navContainer = budgetLink.parentElement;
	while (navContainer) {
		if (navContainer.querySelector('a[href="/reports"]') && navContainer.querySelector('a[href="/schedules"]')) {
			break;
		}
		navContainer = navContainer.parentElement;
	}
	if (!navContainer) return;

	const bar = document.createElement("div");
	bar.setAttribute(BAR_ATTR, "1");
	bar.innerHTML = `
		<svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
		<span class="search-text">Search…</span>
		<span class="search-kbd">${isMac() ? "⌘K" : "Ctrl+K"}</span>
	`;

	bar.addEventListener("click", () => {
		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "k",
				code: "KeyK",
				metaKey: isMac(),
				ctrlKey: !isMac(),
				bubbles: true,
			}),
		);
	});

	navContainer.parentElement?.insertBefore(bar, navContainer);
}

export const sidebarSearch = defineSetting({
	type: "checkbox",
	label: "Sidebar Search Bar",
	description: "Quickly filter accounts, categories, and pages.",
	group: "Sidebar",
	icon: "search",
	context: {
		key: "sidebar-search-enabled",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(renderBar);

		return () => {
			unwatch();
			document.querySelectorAll(`[${BAR_ATTR}]`).forEach((el) => el.remove());
		};
	},
});
