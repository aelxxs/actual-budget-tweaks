import { getValue, setValue } from "@lib/utilities/store";

export type UserTheme = {
	id: string;
	name: string;
	mode: "dark" | "light";
	type: "palette" | "css";
	keys?: Record<string, string>;
	css?: string;
};

type UserThemeMap = Record<string, UserTheme>;

const STORAGE_KEY = "user-themes";

export const userThemeState = $state<{ themes: UserThemeMap }>({ themes: {} });

export async function loadUserThemes() {
	const stored = await getValue<UserThemeMap>(STORAGE_KEY, {});
	userThemeState.themes = stored ?? {};
}

export async function saveUserTheme(theme: UserTheme) {
	userThemeState.themes[theme.id] = theme;
	await setValue(STORAGE_KEY, { ...userThemeState.themes });
}

export async function deleteUserTheme(id: string) {
	delete userThemeState.themes[id];
	await setValue(STORAGE_KEY, { ...userThemeState.themes });
}

export function generateThemeId(): string {
	return `user:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function isUserTheme(key: string): boolean {
	return key.startsWith("user:");
}

export function getPreviewColorsFromTheme(theme: UserTheme): string[] {
	if (theme.type === "palette" && theme.keys) {
		return [
			theme.keys["--ctp-base"],
			theme.keys["--ctp-mantle"],
			theme.keys["--ctp-surface0"],
			theme.keys["--ctp-text"],
			theme.keys["--ctp-mauve"],
			theme.keys["--ctp-blue"],
		].filter(Boolean) as string[];
	}
	return [];
}
