import { getValue, setValue, watchValue } from "@lib/store";

// The account icons ABT stores: read by the sidebar, filters, graph and mobile lists, and
// drawn on Actual's own pages by the Account icons setting.
const STORAGE_KEY_PREFIX = "abt-account-icons";
const EMOJI_ASSET_BASE_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

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

function emojiToCodepoint(emoji: string): string {
	const codepoints = Array.from(emoji)
		.map((char) => char.codePointAt(0)?.toString(16))
		.filter((part): part is string => Boolean(part));

	return codepoints
		.filter((part, index) => {
			if (part !== "fe0f") {
				return true;
			}
			const next = codepoints[index + 1];
			// Keep VS16 when it is semantically important in keycap/ZWJ sequences.
			return next === "200d" || next === "20e3";
		})
		.join("-");
}

export function getEmojiAssetUrl(emoji: string): string {
	return `${EMOJI_ASSET_BASE_URL}/${emojiToCodepoint(emoji)}.svg`;
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
