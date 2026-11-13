import { SETTINGS } from "@lib/actual-dom";
import { watchElement } from "@lib/dom/dom-watcher";
import { TWEAKS_HOST_ATTR, settingsAnchor } from "./settings-page";

/**
 * Keeps ABT's settings panel mounted in its anchor, mounting it as the anchor appears and
 * unmounting it as the anchor goes. Returns a cleanup that unmounts it too.
 *
 * Replaces WXT's autoMount, which watched every attribute change in the page and ran its
 * selectors once per change; on a large budget that alone took most of each frame.
 */
export function mountSettingsPanel<App>(
	mountIn: (anchor: HTMLElement) => App,
	unmountApp: (app: App) => void,
): () => void {
	let current: { anchor: HTMLElement; app: App } | null = null;

	const sync = () => {
		const anchor = document.querySelector<HTMLElement>(settingsAnchor());
		if (current && (current.anchor !== anchor || !current.anchor.isConnected)) {
			unmountApp(current.app);
			current = null;
		}
		if (anchor && !current) {
			anchor.replaceChildren();
			current = { anchor, app: mountIn(anchor) };
		}
	};

	// Both places the anchor can be, watched before paint so Actual's own card never shows.
	const stops = [`[${TWEAKS_HOST_ATTR}]`, `${SETTINGS} > :nth-child(2)`].map((selector) =>
		watchElement(selector, sync),
	);
	sync();
	return () => {
		for (const stop of stops) {
			stop();
		}
		if (current) {
			unmountApp(current.app);
			current = null;
		}
	};
}
