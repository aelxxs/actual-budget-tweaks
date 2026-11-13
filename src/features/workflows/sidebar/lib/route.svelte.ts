import { watchDom } from "@lib/dom/dom-watcher";
import { Page, matchesPage } from "@lib/actual/pages";

/*
 * Actual's navigations aren't observable from a content script, so the route is re-read on DOM
 * changes. One watcher for the whole sidebar, and it only notifies when the route changed, so
 * rows don't recompute their active state on every mutation.
 */
function read(): string {
	return `${location.pathname}|${Object.values(Page).filter(matchesPage).join(",")}`;
}

let current = $state(read());
let users = 0;
let stop: (() => void) | null = null;

/** The current route; reading it inside a derived or template makes that recompute on navigation. */
export function route(): string {
	return current;
}

/** Keeps `route()` current while a component that reads it is mounted. */
export function trackRoute(): () => void {
	if (users++ === 0) {
		stop = watchDom(function routeSignal() {
			const next = read();
			if (next !== current) {
				current = next;
			}
		});
	}
	return () => {
		if (--users === 0) {
			stop?.();
			stop = null;
		}
	};
}
