import { getValue, setValue } from "@lib/utilities/store";

export const SIDEBAR_MOUNT_ATTR = "data-abt-live-sidebar";
export const SIDEBAR_COLLAPSED_KEY = "experimental-sidebar-collapsed";
// Set while a panel has folded the sidebar, so a reload that loses the panel can unfold it.
const AUTO_COLLAPSED_KEY = "experimental-sidebar-auto-collapsed";
// Panels holding the sidebar folded; it unfolds when the last one lets go.
const holders = new Set<symbol>();

/** Collapses the live sidebar to its rail. Resolves to a restore, or null if there was nothing to collapse. */
export async function collapseLiveSidebar(): Promise<(() => void) | null> {
	if (!document.querySelector(`[${SIDEBAR_MOUNT_ATTR}]`)) return null;
	if (!holders.size) {
		if (await getValue<boolean>(SIDEBAR_COLLAPSED_KEY, false)) return null;
		await setValue(AUTO_COLLAPSED_KEY, true);
		await setValue(SIDEBAR_COLLAPSED_KEY, true);
	}
	const holder = Symbol();
	holders.add(holder);
	return () => {
		if (holders.delete(holder) && !holders.size) void undoAutoCollapse();
	};
}

/** Unfolds the sidebar if a panel folded it and the user hasn't toggled it since. */
export async function undoAutoCollapse(): Promise<void> {
	if (!(await getValue<boolean>(AUTO_COLLAPSED_KEY, false))) return;
	await setValue(AUTO_COLLAPSED_KEY, false);
	await setValue(SIDEBAR_COLLAPSED_KEY, false);
}

/** The user toggled the sidebar themselves, so a panel closing leaves it as they set it. */
export function clearAutoCollapse(): void {
	holders.clear();
	void setValue(AUTO_COLLAPSED_KEY, false);
}
