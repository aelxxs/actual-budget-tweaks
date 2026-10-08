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

let onSet: ((key: string, value: unknown) => void) | null = null;

/** Lets settings sync mirror writes into Actual; one hook, set by the content script. */
export function onSetValue(hook: typeof onSet): void {
	onSet = hook;
}

export function setValue(key: string, value: unknown) {
	if (isContextInvalidated()) return Promise.resolve();
	try {
		const plain = JSON.parse(JSON.stringify(value));
		onSet?.(key, plain);
		return browser.storage.local.set({ ["local:" + key]: plain });
	} catch {
		return Promise.resolve();
	}
}

/** Calls back with each new value stored under `key`, from any tab or view; returns an unsubscribe. */
export function watchValue<T>(key: string, callback: (value: T | undefined) => void): () => void {
	const storageKey = "local:" + key;
	const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
		if (area === "local" && storageKey in changes) callback(changes[storageKey].newValue as T);
	};
	try {
		browser.storage.onChanged.addListener(listener);
	} catch {
		return () => {};
	}
	return () => {
		try {
			browser.storage.onChanged.removeListener(listener);
		} catch {
			// the extension context may already be gone
		}
	};
}

export async function removeValue(key: string): Promise<void> {
	if (isContextInvalidated()) return;
	try {
		await browser.storage.local.remove("local:" + key);
	} catch {
		// best effort, like the other helpers
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
