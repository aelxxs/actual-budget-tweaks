import { sidepanel } from "@features/core/side-panel";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import { DEFAULT_THEME } from "../defaults";
import ThemeCustomizer, { GALLERY_APP_KEY } from "../ThemeCustomizer.svelte";

let mounted: Mounted | null = null;
let stop: (() => void) | null = null;
let shown = false;

function close(): void {
	stop?.();
	stop = null;
	mounted?.destroy();
	mounted = null;
	shown = false;
}

/** The theme gallery on any page, following you like Style and Theme Studio. */
export function openThemeGallery(): void {
	close();
	mounted = mountToNodeWithReturn(ThemeCustomizer, {
		ctx: { key: "catppuccin-palette", defaultValue: DEFAULT_THEME },
		galleryOnly: true,
	});
	stop = watchDom(() => {
		if (sidepanel.isOpen(GALLERY_APP_KEY)) {
			shown = true;
		} else if (shown) {
			close();
		}
	});
}
