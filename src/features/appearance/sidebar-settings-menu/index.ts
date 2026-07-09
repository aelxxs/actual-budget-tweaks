import { icon } from "@lib/icons";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { createLogger } from "@lib/utilities/logger";
import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
import { mountToNode } from "@lib/utilities/svelte";
import SidebarSettingsMenu from "./SidebarSettingsMenu.svelte";

const log = createLogger("sidebar-settings-menu");

const COG_ATTR = "data-abt-sidebar-settings-btn";
const MENU_WRAP_CLASS = "abt-sidebar-settings-menu-wrap";

const CSS = `
	.${COG_ATTR.slice(5)} {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: currentColor;
		padding: 5px;
		border-radius: 4px;
		cursor: pointer;
		flex-shrink: 0;
	}
	.${COG_ATTR.slice(5)}:hover {
		background: color-mix(in srgb, currentColor 12%, transparent);
	}

	.${MENU_WRAP_CLASS} {
		position: fixed;
		z-index: 10000;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		border-radius: 6px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		font-family: inherit;
	}
`;

// Matches by both the "Add account" text AND its plus-icon path — either
// signal changing alone (i18n relabel, icon-library swap) shouldn't silently
// break this, but requiring both avoids matching an unrelated "add" button
// that happens to share one of the two.
function findAddAccountButton(): HTMLButtonElement | null {
	const buttons = document.querySelectorAll<HTMLButtonElement>("button");
	log.debug(`scanning ${buttons.length} buttons for "Add account"`);
	for (const btn of buttons) {
		const text = btn.textContent?.trim();
		const hasPlusIcon = btn.querySelector('path[d^="M23 11.5"]');
		if (text === "Add account" && hasPlusIcon) {
			log.debug("found Add account button", btn);
			return btn;
		}
	}
	log.debug("Add account button not found this pass");
	return null;
}

function injectCogButton(): void {
	if (document.querySelector(`[${COG_ATTR}]`)) return;

	const addAccountBtn = findAddAccountButton();
	if (!addAccountBtn) return;

	const row = addAccountBtn.parentElement;
	const footer = row?.parentElement;
	if (!footer) {
		log.warn("Add account button found but has no grandparent to anchor to", addAccountBtn);
		return;
	}

	footer.style.display = "flex";
	footer.style.flexDirection = "row";
	footer.style.alignItems = "center";
	footer.style.gap = "2px";
	if (row) row.style.flex = "1";

	const cogBtn = document.createElement("button");
	cogBtn.type = "button";
	cogBtn.setAttribute(COG_ATTR, "1");
	cogBtn.className = COG_ATTR.slice(5);
	cogBtn.title = "Sidebar settings";
	cogBtn.setAttribute("aria-label", "Sidebar settings");
	cogBtn.innerHTML = icon("cog", { size: 14 });
	cogBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		log.debug("cog button clicked");
		toggleMenu(cogBtn);
	});
	footer.appendChild(cogBtn);
	log.info("cog button injected", cogBtn);
}

let menuWrap: HTMLElement | null = null;
let stopOutsideClick: (() => void) | null = null;

function closeMenu(): void {
	if (!menuWrap) return;
	log.debug("closing menu");
	menuWrap.remove();
	menuWrap = null;
	stopOutsideClick?.();
	stopOutsideClick = null;
}

function toggleMenu(anchor: HTMLElement): void {
	if (menuWrap) {
		closeMenu();
		return;
	}

	log.debug("opening menu", anchor);
	const wrap = mountToNode(SidebarSettingsMenu);
	wrap.className = MENU_WRAP_CLASS;
	wrap.style.display = "block";
	document.body.appendChild(wrap);
	menuWrap = wrap;

	positionPopover(wrap, anchor, { gap: 6 });
	stopOutsideClick = onOutsideClick([wrap, anchor], closeMenu);
	log.debug("menu positioned", wrap.getBoundingClientRect());
}

export const sidebarSettingsMenu = {
	type: "core" as const,
	init: () => {
		log.info("init");
		applyGlobalCSS(CSS, "sidebar-settings-menu");
		const unwatch = watchDom(injectCogButton);

		return () => {
			log.info("cleanup");
			unwatch();
			closeMenu();
			document.querySelector(`[${COG_ATTR}]`)?.remove();
		};
	},
};
