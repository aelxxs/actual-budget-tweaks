import { DEFAULT_THEME } from "./defaults";

export const CSS_OVERRIDES_KEY = "theme-css-overrides";

export const editorState = $state({
	activeTheme: DEFAULT_THEME,
	/** Each theme's CSS override, keyed by theme, applied on top of it. */
	cssOverrides: {} as Record<string, string>,
});
