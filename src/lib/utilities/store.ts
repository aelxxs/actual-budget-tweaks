function isContextInvalidated(): boolean {
	try {
		return !browser.runtime?.id;
	} catch {
		return true;
	}
}

export async function getValue<T>(key: string, defaultValue: T): Promise<T> {
	if (isContextInvalidated()) return defaultValue;
	try {
		const result = await browser.storage.local.get("local:" + key);
		return (result["local:" + key] ?? defaultValue) as T;
	} catch {
		return defaultValue;
	}
}

/** Distinguishes "never stored" from "stored a falsy/default-looking value" — getValue's fallback can't tell these apart. */
export async function hasValue(key: string): Promise<boolean> {
	if (isContextInvalidated()) return false;
	try {
		const result = await browser.storage.local.get("local:" + key);
		return result["local:" + key] !== undefined;
	} catch {
		return false;
	}
}

export function setValue(key: string, value: unknown) {
	if (isContextInvalidated()) return Promise.resolve();
	try {
		return browser.storage.local.set({ ["local:" + key]: value });
	} catch {
		return Promise.resolve();
	}
}

export function normalizeBaseUrl(input: string | null | undefined): string | null {
	if (!input) return null;
	try {
		const url = new URL(input);
		return `${url.protocol}//${url.host}/`;
	} catch {
		return null;
	}
}

export async function getBaseUrl() {
	const userLink = await getValue("user-link", null);
	return normalizeBaseUrl(userLink as string | null);
}
