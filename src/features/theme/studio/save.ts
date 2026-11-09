import { sidepanel } from "@features/core/side-panel";
import { getValue, setValue } from "@lib/utilities/store";
import { generateThemeId, saveUserTheme } from "../user-themes.svelte";
import { paletteKeys } from "./effects";
import { generate } from "./generator";
import { copyRecipe } from "./recipes";
import { studio } from "./state.svelte";

/**
 * Saves the recipe as a custom theme and makes it the one in use (its mode's slot under Match
 * system). Closing the panel then puts it on, through the same path as any saved theme.
 */
export async function saveStudioTheme(asNew = false): Promise<void> {
	const recipe = copyRecipe(studio.recipe);
	recipe.name = recipe.name.trim() || "My theme";
	const id = !asNew && studio.editing ? studio.editing : generateThemeId();
	await saveUserTheme({
		id,
		name: recipe.name,
		mode: recipe.mode,
		type: "palette",
		keys: paletteKeys(generate(recipe)),
		recipe,
	});
	if (await getValue<boolean>("theme-auto-switch", false)) {
		await setValue(recipe.mode === "dark" ? "theme-auto-dark" : "theme-auto-light", id);
	} else {
		await setValue("catppuccin-palette", id);
	}
	sidepanel.close();
}
