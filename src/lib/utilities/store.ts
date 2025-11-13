export async function getValue(key: string, defaultValue: unknown) {
	const result = await browser.storage.local.get("local:" + key);
	return result["local:" + key] ?? defaultValue;
}

export function setValue(key: string, value: unknown) {
	return browser.storage.local.set({ ["local:" + key]: value });
}

export async function getBaseUrl() {
	const userLink = await getValue("user-link", null);
	if (!userLink) return null;
	try {
		const url = new URL(userLink);
		return `${url.protocol}//${url.host}/`;
	} catch (e) {
		return null;
	}
}
