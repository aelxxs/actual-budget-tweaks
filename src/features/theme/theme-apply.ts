import { BUDGET_LINK } from "@lib/actual-dom";
import { getTheme, themes } from "@lib/design";
import { applyGlobalCSS } from "@lib/dom/dom";
import { watchElement } from "@lib/dom/dom-watcher";
import { setValue } from "@lib/store";
import { THEME_APPLIED_EVENT } from "@lib/theme-events";
import { CSS_OVERRIDES_KEY, editorState } from "./editor-state.svelte";
import { effectsFor, loadThemeEffects, NO_EFFECTS } from "./effects-store.svelte";
import type { PaletteTheme } from "@lib/design/types";
import { paletteCSS } from "./palette-css";
import { STUDIO_STYLE_ID, studioCSS, themeEffectsCSS, themeFromRecipe } from "./studio/effects";
import type { Mode } from "./studio/generator";
import { isUserTheme, userThemeState } from "./user-themes.svelte";

export type RemoteTheme = {
	name: string;
	repo: string;
	colors: string[];
	mode: "light" | "dark";
};

const TOKENS_STYLE_ID = "color-tokens";
const CSS_OVERRIDE_STYLE_ID = "theme-css-override";

export async function saveCssOverride(key: string, css: string): Promise<void> {
	const { [key]: _, ...rest } = editorState.cssOverrides;
	editorState.cssOverrides = css ? { ...rest, [key]: css } : rest;
	await setValue(CSS_OVERRIDES_KEY, editorState.cssOverrides);
	if (editorState.activeTheme === key) {
		applyOverrides(key);
	}
}
export const NATIVE_THEME_KEY = "native";

const originalRootProperties = new Map<string, { value: string; priority: string }>();

/** Keys a theme can leave out (the sidebar's, the border's) don't linger from the one before. */
function clearMissingKeys(root: HTMLElement, keys: Record<string, string>) {
	for (const prop of Array.from(root.style)) {
		if (prop.startsWith("--ctp-") && !(prop in keys)) {
			root.style.removeProperty(prop);
		}
	}
}

function setRootProperty(root: HTMLElement, name: string, value: string) {
	if (!originalRootProperties.has(name)) {
		originalRootProperties.set(name, {
			value: root.style.getPropertyValue(name),
			priority: root.style.getPropertyPriority(name),
		});
	}
	root.style.setProperty(name, value);
}

export function isCommunityTheme(value: string): boolean {
	return value.includes("/");
}

export function applyPaletteTheme(id: string, theme: PaletteTheme) {
	const root = document.querySelector<HTMLElement>(":root");
	if (!root) {
		return;
	}
	clearMissingKeys(root, theme.keys);
	for (const [varName, val] of Object.entries(theme.keys)) {
		setRootProperty(root, varName, val);
	}
	applyGlobalCSS(paletteCSS(theme), TOKENS_STYLE_ID);
	editorState.activeTheme = id;
	applyOverrides(id);
}

export function applyUserCSSTheme(id: string, css: string) {
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const prop of Array.from(root.style)) {
			if (prop.startsWith("--ctp-")) {
				root.style.removeProperty(prop);
			}
		}
	}
	applyGlobalCSS(css, TOKENS_STYLE_ID);
	editorState.activeTheme = id;
	applyOverrides(id);
}

export function applyOverrides(key: string) {
	// Re-added so it comes after the theme's own tag, which may have just been recreated.
	applyGlobalCSS("", CSS_OVERRIDE_STYLE_ID);
	applyGlobalCSS(editorState.cssOverrides[key] ?? "", CSS_OVERRIDE_STYLE_ID);
	syncWindowColor();
	// Every way of putting a theme on ends here.
	document.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
}

/**
 * Keeps the window's title bar (an installed app, or a Safari web app) on the theme: it takes the
 * theme-color tag and the body's background, which Actual resolves from its own theme, sometimes
 * before ABT's has loaded. Re-resolved when a budget opens and whenever Actual rewrites the tag.
 */
export function watchWindowColor(): void {
	watchElement(BUDGET_LINK, syncWindowColor);
	const tag = new MutationObserver(syncWindowColor);
	let watched: Element | null = null;
	// Just the tag, which Actual may add later; the rest of the head changes with every style.
	const findTag = () => {
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta && meta !== watched) {
			watched = meta;
			tag.disconnect();
			tag.observe(meta, { attributes: true, attributeFilter: ["content"] });
			syncWindowColor();
		}
	};
	new MutationObserver(findTag).observe(document.head, { childList: true });
	findTag();
	syncWindowColor();
}

/** Only with a budget open, since the budget list sets its own colour. */
export function syncWindowColor() {
	const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (!meta || !document.querySelector(BUDGET_LINK)) {
		return;
	}
	// Through a probe so a color-mix() or var() comes back as a colour the tag can hold.
	const probe = document.createElement("div");
	// Inset panels' Floating page sets --abt-window-color so the title bar meets its frame.
	probe.style.color = "var(--abt-window-color, var(--color-mobileViewTheme))";
	document.body.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	if (color && meta.content !== color) {
		meta.content = color;
		document.body.style.backgroundColor = color;
	}
}

function applyPalette(name: string) {
	applyPaletteTheme(name, getTheme(name));
}

const COMMUNITY_CATALOG_URL =
	"https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/data/customThemeCatalog.json";

export async function fetchCommunityThemeCatalog(): Promise<RemoteTheme[]> {
	const res = await browser.runtime.sendMessage({
		type: "fetch",
		responseType: "json",
		url: COMMUNITY_CATALOG_URL,
	});
	if (!res?.ok) {
		throw new Error(`Could not fetch community theme catalog (status ${res?.status})`);
	}
	return res.data;
}

export function getBuiltinPreviewColors(key: string): string[] {
	const theme = themes[key];
	if (!theme) {
		return [];
	}
	const k = theme.keys;
	return [
		k["--ctp-base"],
		k["--ctp-mantle"],
		k["--ctp-surface0"],
		k["--ctp-text"],
		k["--ctp-mauve"],
		k["--ctp-blue"],
	].filter(Boolean) as string[];
}

const NATIVE_PREVIEW_TOKENS = [
	"--color-pageBackground",
	"--color-tableBackground",
	"--color-sidebarBackground",
	"--color-pageText",
	"--color-buttonPrimaryBackground",
	"--color-pageTextLink",
];

/**
 * Actual's own colours for its current theme setting. Read from Actual's theme rule, whose
 * `var(--palette-*)` values ABT themes never override, so it's right under any ABT theme.
 */
export function getNativePreviewColors(): string[] {
	const root = getComputedStyle(document.documentElement);
	for (const sheet of document.styleSheets) {
		const owner = sheet.ownerNode;
		if (!(owner instanceof HTMLStyleElement) || owner.id.startsWith("ABT-")) {
			continue;
		}
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const rule of rules) {
			if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ":root") {
				continue;
			}
			if (!rule.style.getPropertyValue("--color-pageBackground")) {
				continue;
			}
			return NATIVE_PREVIEW_TOKENS.map((token) => {
				const value = rule.style.getPropertyValue(token).trim();
				const ref = value.match(/^var\((--[\w-]+)\)$/)?.[1];
				return ref ? root.getPropertyValue(ref).trim() : value;
			}).filter(Boolean);
		}
	}
	return [];
}

export async function fetchCommunityCSS(repo: string): Promise<string> {
	const branches = ["main", "master"];
	for (const branch of branches) {
		const url = `https://raw.githubusercontent.com/${repo}/${branch}/actual.css`;
		const res = await browser.runtime.sendMessage({ type: "fetch", url });
		if (res?.ok) {
			return res.data;
		}
	}
	throw new Error(`Could not fetch actual.css from ${repo}`);
}

async function applyCommunityTheme(repo: string) {
	const css = await fetchCommunityCSS(repo);
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const prop of Array.from(root.style)) {
			if (prop.startsWith("--ctp-")) {
				root.style.removeProperty(prop);
			}
		}
	}
	applyGlobalCSS(css, TOKENS_STYLE_ID);
	editorState.activeTheme = repo;
	applyOverrides(repo);
}

function applyNativeTheme() {
	applyGlobalCSS("", TOKENS_STYLE_ID);
	const root = document.querySelector<HTMLElement>(":root");
	if (root) {
		for (const [prop, original] of originalRootProperties) {
			if (original.value) {
				root.style.setProperty(prop, original.value, original.priority);
			} else {
				root.style.removeProperty(prop);
			}
		}
	}
	originalRootProperties.clear();
	editorState.activeTheme = NATIVE_THEME_KEY;
	applyOverrides(NATIVE_THEME_KEY);
}

/** Whether the page background in use is light, read from the screen as the theme paints it. */
export function pageMode(): Mode {
	const probe = document.createElement("div");
	probe.style.color = "var(--color-pageBackground)";
	document.body.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	// A canvas turns any CSS color (oklch, color-mix) into RGB.
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) {
		return "dark";
	}
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 128 ? "light" : "dark";
}

/** Paints a theme's glow and grain: a Studio theme's from its recipe, any other's as saved for it. */
export async function applyThemeEffects(key: string = editorState.activeTheme): Promise<void> {
	const recipe = isUserTheme(key) ? userThemeState.themes[key]?.recipe : undefined;
	if (recipe) {
		applyGlobalCSS(studioCSS(recipe), STUDIO_STYLE_ID);
		return;
	}
	await loadThemeEffects();
	const effects = effectsFor(key);
	applyGlobalCSS(
		effects === NO_EFFECTS ? "" : themeEffectsCSS(effects, pageMode()),
		STUDIO_STYLE_ID,
	);
}

export async function applyThemeByKey(key: string, fallback: string) {
	const recipe = isUserTheme(key) ? userThemeState.themes[key]?.recipe : undefined;
	applyGlobalCSS(recipe ? studioCSS(recipe) : "", STUDIO_STYLE_ID);
	if (key === NATIVE_THEME_KEY) {
		applyNativeTheme();
	} else if (isUserTheme(key)) {
		const userTheme = userThemeState.themes[key];
		if (userTheme) {
			if (userTheme.type === "palette" && (recipe || userTheme.keys)) {
				applyPaletteTheme(
					key,
					recipe ? themeFromRecipe(recipe) : { mode: userTheme.mode, keys: userTheme.keys! },
				);
			} else if (userTheme.type === "css" && userTheme.css) {
				applyUserCSSTheme(key, userTheme.css);
			}
		} else {
			applyPalette(fallback);
		}
	} else if (isCommunityTheme(key)) {
		try {
			await applyCommunityTheme(key);
		} catch {
			applyPalette(fallback);
		}
	} else {
		applyPalette(key);
	}
	if (!recipe) {
		await applyThemeEffects(key);
	}
}
