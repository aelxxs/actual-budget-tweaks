export async function getValue(key: string, defaultValue: unknown) {
	const result = await browser.storage.local.get("local:" + key);
	return result["local:" + key] ?? defaultValue;
}

export function setValue(key: string, value: unknown) {
	return browser.storage.local.set({ ["local:" + key]: value });
}
