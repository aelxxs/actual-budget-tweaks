import { sidepanel } from "@features/core/side-panel";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn, mountToPanelBody } from "@lib/dom/svelte";
import { userThemeState } from "../user-themes.svelte";
import { restoreSavedTheme } from "./apply";
import { recipeFromPalette } from "./generator";
import { copyRecipe } from "./recipes";
import { studio } from "./state.svelte";
import StudioHeader from "./StudioHeader.svelte";
import ThemeStudio from "./ThemeStudio.svelte";

let mounted: (Mounted & { shown: boolean }) | null = null;
let header: Mounted | null = null;
let stop: (() => void) | null = null;

/** Opens the studio on a copy of a palette from elsewhere (a built-in theme), saved as a new theme. */
export function openPaletteInStudio(keys: Record<string, string>, name: string): void {
	studio.editing = null;
	studio.recipe = recipeFromPalette(keys, `${name} (Studio)`);
	studio.recent = [];
	openThemeStudio();
}

/**
 * Opens the theme studio on whatever page you're on; it follows you, so any page can be its
 * preview. With a saved studio theme's id, it opens on that theme and Save updates it; with another
 * palette theme's, it starts from an approximation and saves alongside, so the original keeps its
 * exact colors.
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
	mounted = { ...mountToPanelBody(ThemeStudio, {}), shown: false };
	// The panel's header slot is display: contents, so this wrapper is the flex item that grows.
	const slot = document.createElement("div");
	slot.style.cssText = "flex: 1; min-width: 0;";
	header = mountToNodeWithReturn(StudioHeader, {}, slot);
	sidepanel.open({
		title: "Theme Studio",
		bodyNode: mounted.node,
		headerNode: header.node,
		key: "theme-studio",
		scope: "app",
	});
	stop ??= watchDom(sync);
}

function sync(): void {
	if (!mounted) {
		return;
	}
	if (mounted.node.isConnected) {
		mounted.shown = true;
		return;
	}
	// Closed: back to the saved theme and real data.
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
