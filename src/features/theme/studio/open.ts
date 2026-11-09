import { sidepanel } from "@features/core/side-panel";
import { BUDGET_TABLE } from "@lib/actual-dom";
import { navigate } from "@lib/utilities/actual-api";
import { watchDom } from "@lib/utilities/dom-watcher";
import { getCurrentPath } from "@lib/utilities/route-watcher";
import { type Mounted, mountToNodeWithReturn, mountToPanelBody } from "@lib/utilities/svelte";
import { restoreSavedTheme } from "./apply";
import { clearPreviewState } from "./preview-states";
import { studio } from "./state.svelte";
import StudioHeader from "./StudioHeader.svelte";
import ThemeStudio from "./ThemeStudio.svelte";

const PANEL_WIDTH = 360;

let mounted: (Mounted & { shown: boolean }) | null = null;
let header: Mounted | null = null;
let stop: (() => void) | null = null;
let waitingForBudget = false;

/** Opens the theme studio beside the Budget page, which serves as its live preview. */
export function openThemeStudio(): void {
	if (mounted?.node.isConnected) {
		return;
	}
	waitingForBudget = true;
	stop ??= watchDom(sync);
	if (getCurrentPath() === "/budget") {
		sync();
	} else {
		navigate("/budget");
	}
}

function sync(): void {
	if (waitingForBudget) {
		// The panel closes on navigation, so it opens once the budget has rendered.
		if (getCurrentPath() !== "/budget" || !document.querySelector(BUDGET_TABLE)) {
			return;
		}
		waitingForBudget = false;
		mounted = { ...mountToPanelBody(ThemeStudio, {}), shown: false };
		header = mountToNodeWithReturn(StudioHeader, {});
		sidepanel.open({
			title: "Theme Studio",
			bodyNode: mounted.node,
			headerNode: header.node,
			width: PANEL_WIDTH,
		});
		return;
	}
	if (!mounted) {
		return;
	}
	if (mounted.node.isConnected) {
		mounted.shown = true;
		return;
	}
	// Closed, or another panel or page took its place: back to the saved theme and real data.
	if (mounted.shown) {
		close();
	}
}

function close(): void {
	mounted?.destroy();
	mounted = null;
	header?.destroy();
	header = null;
	stop?.();
	stop = null;
	studio.preview = "healthy";
	clearPreviewState();
	void restoreSavedTheme();
}
