import { icon } from "@lib/icons";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { createLogger } from "@lib/utilities/logger";
import { NATIVE_ROOT_ATTR } from "@features/workflows/sidebar/lib/data";
import { openSidebarSettings } from "./settings";

const log = createLogger("sidebar-settings-menu");

const COG_ATTR = "data-abt-sidebar-settings-btn";

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
`;

// Matches by both the "Add account" text AND its plus-icon path — either
// signal changing alone (i18n relabel, icon-library swap) shouldn't silently
// break this, but requiring both avoids matching an unrelated "add" button
// that happens to share one of the two.
function findAddAccountButton(): HTMLButtonElement | null {
	const buttons = document.querySelectorAll<HTMLButtonElement>('button:has(path[d^="M23 11.5"])');
	log.debug(`checking ${buttons.length} plus-icon buttons for "Add account"`);
	for (const btn of buttons) {
		if (btn.textContent?.trim() === "Add account") {
			log.debug("found Add account button", btn);
			return btn;
		}
	}
	log.debug("Add account button not found this pass");
	return null;
}

function injectCogButton(): void {
	if (document.querySelector(`[${COG_ATTR}]`)) return;
	// The live sidebar hides the native one (and has its own settings), so the
	// button would never be found and this would rescan on every DOM change.
	if (document.querySelector(`[${NATIVE_ROOT_ATTR}]`)) return;

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
		openSidebarSettings();
	});
	footer.appendChild(cogBtn);
	log.info("cog button injected", cogBtn);
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
			document.querySelector(`[${COG_ATTR}]`)?.remove();
		};
	},
};
