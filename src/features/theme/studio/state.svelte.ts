import type { Recipe } from "./generator";
import { copyRecipe, PRESETS } from "./recipes";

const RECENT_LIMIT = 5;

export const studio = $state({
	recipe: copyRecipe(PRESETS[0]),
	/** The last few shuffles, newest first. */
	recent: [] as Recipe[],
	/** The glow light the color and brightness controls edit. */
	light: 0,
	/** The saved theme being edited, which Save overwrites; null for a new one. */
	editing: null as string | null,
});

export function remember(r: Recipe): void {
	studio.recent = [copyRecipe(r), ...studio.recent].slice(0, RECENT_LIMIT);
}
