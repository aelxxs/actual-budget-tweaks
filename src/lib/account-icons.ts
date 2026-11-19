import { getValue, setValue, watchValue } from "@lib/store";

// The account icons ABT stores: read by the sidebar, filters, graph and mobile lists, and
// drawn on Actual's own pages by the Account icons setting.
const STORAGE_KEY_PREFIX = "abt-account-icons";

export interface AccountIconData {
	type: "emoji" | "dataUrl" | "url";
	value: string;
}

let iconCache: Record<string, AccountIconData> | null = null;
let iconCachePromise: Promise<Record<string, AccountIconData>> | null = null;

/** The icons once loaded, for drawing synchronously from a DOM watcher; null until then. */
export function cachedIcons(): Record<string, AccountIconData> | null {
	return iconCache;
}

export async function loadIconCache(): Promise<Record<string, AccountIconData>> {
	if (iconCache) {
		return iconCache;
	}
	if (iconCachePromise) {
		return iconCachePromise;
	}

	iconCachePromise = (async () => {
		const icons = (await getValue(
			STORAGE_KEY_PREFIX,
			{} as Record<string, AccountIconData>,
		)) as Record<string, AccountIconData>;
		iconCache = icons;
		iconCachePromise = null;
		return icons;
	})().catch((error) => {
		iconCachePromise = null;
		throw error;
	});

	return iconCachePromise;
}

/** Calls `callback` with the whole map whenever it's saved, here or by settings sync. */
export function watchAccountIcons(
	callback: (icons: Record<string, AccountIconData>) => void,
): () => void {
	return watchValue<Record<string, AccountIconData>>(STORAGE_KEY_PREFIX, (icons) => {
		iconCache = icons ?? {};
		callback(iconCache);
	});
}

export async function setAccountIcon(accountId: string, iconData: AccountIconData): Promise<void> {
	const icons = await loadIconCache();
	icons[accountId] = iconData;
	await setValue(STORAGE_KEY_PREFIX, icons);
}

export async function removeAccountIcon(accountId: string): Promise<void> {
	const icons = await loadIconCache();
	delete icons[accountId];
	await setValue(STORAGE_KEY_PREFIX, icons);
}
