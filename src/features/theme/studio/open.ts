import { sidepanel } from "@features/core/side-panel";
import { BUDGET_TABLE } from "@lib/actual-dom";
import { navigate } from "@lib/utilities/actual-api";
import { watchDom } from "@lib/utilities/dom-watcher";
import { getCurrentPath } from "@lib/utilities/route-watcher";
import { type Mounted, mountToNodeWithReturn, mountToPanelBody } from "@lib/utilities/svelte";
import { userThemeState } from "../user-themes.svelte";
import { restoreSavedTheme } from "./apply";
import { recipeFromPalette } from "./generator";
import { copyRecipe } from "./recipes";
import { studio } from "./state.svelte";
import StudioHeader from "./StudioHeader.svelte";
import ThemeStudio from "./ThemeStudio.svelte";

const PANEL_WIDTH = 360;

let mounted: (Mounted & { shown: boolean }) | null = null;
let header: Mounted | null = null;
let stop: (() => void) | null = null;
let waitingForBudget = false;

/**
 * Opens the theme studio beside the Budget page, which serves as its live preview. With a saved
 * studio theme's id, it opens on that theme and Save updates it; with another palette theme's, it
 * starts from an approximation and saves alongside, so the original keeps its exact colors.
 */
export function openThemeStudio(themeId?: string): void {
	const saved = themeId ? userThemeState.themes[themeId] : undefined;
	const recipe = saved?.recipe;
	studio.editing = recipe ? themeId! : null;
	if (!recipe && saved?.keys) {
		studio.recipe = recipeFromPalette(saved.keys, `${saved.name} (Studio)`);
		studio.recent = [];
	}
	if (recipe) {
		studio.recipe = copyRecipe(recipe);
		for (const light of studio.recipe.glow.lights) {
			light.color ??= (light as { colour?: string }).colour ?? "accent";
		}
		studio.recent = [];
	}
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
		// The panel's header slot is display: contents, so this wrapper is the flex item that grows.
		const slot = document.createElement("div");
		slot.style.cssText = "flex: 1; min-width: 0;";
		header = mountToNodeWithReturn(StudioHeader, {}, slot);
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
	void restoreSavedTheme();
}
