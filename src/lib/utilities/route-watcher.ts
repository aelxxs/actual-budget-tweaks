let patched = false;

function ensurePatched(): void {
	if (patched) return;
	patched = true;

	for (const method of ["pushState", "replaceState"] as const) {
		const original = history[method].bind(history);
		history[method] = function (...args: Parameters<typeof history.pushState>) {
			const result = original(...args);
			window.dispatchEvent(new Event("abt:locationchange"));
			return result;
		};
	}
}

/**
 * Subscribes to SPA navigation (pushState/replaceState/popstate/hashchange),
 * calling `callback` immediately and again on every subsequent route change.
 * The history patch is installed once and shared across all subscribers.
 */
export function watchRoute(callback: () => void): () => void {
	ensurePatched();
	callback();

	window.addEventListener("popstate", callback);
	window.addEventListener("hashchange", callback);
	window.addEventListener("abt:locationchange", callback);

	return () => {
		window.removeEventListener("popstate", callback);
		window.removeEventListener("hashchange", callback);
		window.removeEventListener("abt:locationchange", callback);
	};
}

export function getCurrentPath(): string {
	return window.location.pathname;
}
