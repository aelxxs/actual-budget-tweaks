/**
 * What part of the page last showed, kept in the page's own storage. That reads synchronously, so
 * the next load's first frame matches the last one instead of starting empty and shifting as the
 * real data arrives. Only a starting point: the real value always replaces it.
 */
const PREFIX = "abt-last:";

export function lastShown<T>(name: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(PREFIX + name);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function rememberShown(name: string, value: unknown): void {
	try {
		localStorage.setItem(PREFIX + name, JSON.stringify(value));
	} catch {
		// The next load starts from the fallback instead.
	}
}
