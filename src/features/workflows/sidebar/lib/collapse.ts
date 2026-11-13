import { getValue, removeValue } from "@lib/utilities/store";

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
// Set by panels that used to fold the sidebar; one left set from before is undone once.
const AUTO_COLLAPSED_KEY = "experimental-sidebar-auto-collapsed";

export async function undoAutoCollapse(): Promise<void> {
	if (!(await getValue<boolean>(AUTO_COLLAPSED_KEY, false))) {
		return;
	}
	await removeValue(AUTO_COLLAPSED_KEY);
	setSidebarCollapsed(false);
}
