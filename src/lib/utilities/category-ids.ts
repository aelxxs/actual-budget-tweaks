import { watchDom } from "./dom-watcher";

export const CATEGORY_ID_ATTR = "data-abt-category-id";

let users = 0;
let unwatch: (() => void) | null = null;

/** Keeps category cells and dropdown rows tagged with their id while any feature needs it. */
export function trackCategoryIds(): () => void {
	users++;
	unwatch ??= watchDom(() => {
		document.dispatchEvent(new CustomEvent("abt:api:mark-category-ids"));
	});
	return () => {
		users--;
		if (users > 0) {
			return;
		}
		unwatch?.();
		unwatch = null;
		for (const el of document.querySelectorAll(`[${CATEGORY_ID_ATTR}]`)) {
			el.removeAttribute(CATEGORY_ID_ATTR);
		}
	};
}
