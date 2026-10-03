import { DEFAULT_THEME } from "./defaults";

export type ThemeOverrides = Record<string, Record<string, string>>;

export const editorState = $state({
	isSaving: false,
	isDirty: false,
	activeTheme: DEFAULT_THEME,
	overrides: {} as ThemeOverrides,
});

export let resetFn = () => {};
export function setResetFn(fn: () => void) {
	resetFn = fn;
}
