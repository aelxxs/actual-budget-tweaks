import { getValue, removeValue, setValue } from "@lib/utilities/store";

export const SIDEBAR_MOUNT_ATTR = "data-abt-live-sidebar";
// In the page's own storage, like Actual's sidebar width: it reads synchronously, so the first
// frame is already the right size. Per browser, as it was in the extension's storage.
const COLLAPSED_KEY = "abt-sidebar-collapsed";
const OLD_COLLAPSED_KEY = "experimental-sidebar-collapsed";
const listeners = new Set<(collapsed: boolean) => void>();

export function isSidebarCollapsed(): boolean {
	try {
		return localStorage.getItem(COLLAPSED_KEY) === "true";
	} catch {
		return false;
	}
}

export function setSidebarCollapsed(collapsed: boolean): void {
	try {
		localStorage.setItem(COLLAPSED_KEY, String(collapsed));
	} catch {
		// Still applied to this page, just not remembered.
	}
	for (const listener of listeners) {
		listener(collapsed);
	}
}

export function watchSidebarCollapsed(listener: (collapsed: boolean) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** A collapsed state saved in the extension's storage before, moved here once. */
export async function adoptOldCollapsed(): Promise<void> {
	if (await getValue<boolean | null>(OLD_COLLAPSED_KEY, null)) {
		setSidebarCollapsed(true);
	}
	await removeValue(OLD_COLLAPSED_KEY);
}
// Set while a panel has folded the sidebar, so a reload that loses the panel can unfold it.
const AUTO_COLLAPSED_KEY = "experimental-sidebar-auto-collapsed";
// Panels holding the sidebar folded; it unfolds when the last one lets go.
const holders = new Set<symbol>();

/** Collapses the live sidebar to its rail. Resolves to a restore, or null if there was nothing to collapse. */
export async function collapseLiveSidebar(): Promise<(() => void) | null> {
	if (!document.querySelector(`[${SIDEBAR_MOUNT_ATTR}]`)) {
		return null;
	}
	if (!holders.size) {
		if (isSidebarCollapsed()) {
			return null;
		}
		await setValue(AUTO_COLLAPSED_KEY, true);
		setSidebarCollapsed(true);
	}
	const holder = Symbol();
	holders.add(holder);
	return () => {
		if (holders.delete(holder) && !holders.size) {
			void undoAutoCollapse();
		}
	};
}

/** Unfolds the sidebar if a panel folded it and the user hasn't toggled it since. */
export async function undoAutoCollapse(): Promise<void> {
	if (!(await getValue<boolean>(AUTO_COLLAPSED_KEY, false))) {
		return;
	}
	await setValue(AUTO_COLLAPSED_KEY, false);
	setSidebarCollapsed(false);
}

/** The user toggled the sidebar themselves, so a panel closing leaves it as they set it. */
export function clearAutoCollapse(): void {
	holders.clear();
	void setValue(AUTO_COLLAPSED_KEY, false);
}
