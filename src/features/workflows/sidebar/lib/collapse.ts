import { getValue, setValue } from "@lib/utilities/store";

export const SIDEBAR_MOUNT_ATTR = "data-abt-live-sidebar";
export const SIDEBAR_COLLAPSED_KEY = "experimental-sidebar-collapsed";

/** Collapses the live sidebar to its rail. Resolves to a restore, or null if there was nothing to collapse. */
export async function collapseLiveSidebar(): Promise<(() => void) | null> {
	if (!document.querySelector(`[${SIDEBAR_MOUNT_ATTR}]`)) return null;
	if (await getValue<boolean>(SIDEBAR_COLLAPSED_KEY, false)) return null;
	await setValue(SIDEBAR_COLLAPSED_KEY, true);
	return () => void setValue(SIDEBAR_COLLAPSED_KEY, false);
}
