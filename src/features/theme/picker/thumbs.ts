import { themes } from "@lib/design";
import { fetchCommunityCSS } from "../theme-apply";
import { generate } from "../studio/generator";
import type { UserTheme } from "../user-themes.svelte";

/** The five colors a theme thumbnail is drawn with. */
export type Thumb = { side: string; page: string; card: string; text: string; accent: string };

/** Drawn while a theme's real colors are unknown or still loading. */
export function placeholderThumb(mode: "light" | "dark"): Thumb {
	return mode === "dark"
		? { side: "#24262b", page: "#1b1d21", card: "#26292e", text: "#5b6068", accent: "#5b6068" }
		: { side: "#e6e8ec", page: "#f2f3f5", card: "#ffffff", text: "#b9bdc4", accent: "#b9bdc4" };
}

function fromPalette(keys: Record<string, string>, css?: string): Thumb {
	const k = (name: string) => keys[`--ctp-${name}`];
	// The sidebar follows the cards unless the palette gives it its own color (Daylight's dark one).
	const sidebar = css?.match(/--color-sidebarBackground:\s*(#[0-9a-f]{3,8})/i)?.[1];
	return {
		side: sidebar ?? k("mantle"),
		page: k("crust"),
		card: k("mantle"),
		text: k("text"),
		accent: k("mauve"),
	};
}

export function builtinThumb(key: string): Thumb | null {
	const theme = themes[key];
	return theme ? fromPalette(theme.keys, theme.css) : null;
}

export function userThumb(theme: UserTheme): Thumb {
	if (theme.recipe) {
		const g = generate(theme.recipe);
		return {
			side: g.sidebar.bg,
			page: g.colors.crust,
			card: g.colors.mantle,
			text: g.colors.text,
			accent: g.sidebar.sel,
		};
	}
	if (theme.keys) {
		return fromPalette(theme.keys);
	}
	return (theme.css && resolveCss(theme.css, theme.mode)) || placeholderThumb(theme.mode);
}

/** Actual's own theme, from the colors getNativePreviewColors reads (page, table, sidebar, text, button). */
export function nativeThumb(colors: string[], mode: "light" | "dark"): Thumb {
	const [page, card, side, text, accent] = colors;
	return page && card && side && text && accent
		? { side, page, card, text, accent }
		: placeholderThumb(mode);
}

const TOKENS: Record<keyof Thumb, string[]> = {
	page: ["--color-pageBackground"],
	card: ["--color-tableBackground", "--color-cardBackground"],
	side: ["--color-sidebarBackground"],
	text: ["--color-pageText", "--color-tableText"],
	accent: ["--color-sidebarItemAccentSelected", "--color-buttonPrimaryBackground"],
};

/**
 * Resolves a theme stylesheet's colors as a browser would: its custom properties set on a hidden
 * probe, then each part's background read back. Values may be var() chains or color-mix(), which
 * only the browser can work out. Parts the theme leaves out fall back to the placeholder's.
 */
function resolveCss(css: string, mode: "light" | "dark"): Thumb | null {
	const declarations = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)];
	if (!declarations.length) {
		return null;
	}
	const probe = document.createElement("div");
	probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;";
	// Unset first, or a token the theme leaves out would come from the page's current theme.
	for (const token of Object.values(TOKENS).flat()) {
		probe.style.setProperty(token, "initial");
	}
	for (const [, name, value] of declarations) {
		probe.style.setProperty(name, value.trim());
	}
	const fallback = placeholderThumb(mode);
	const swatches = Object.fromEntries(
		(Object.keys(TOKENS) as (keyof Thumb)[]).map((part) => {
			const swatch = document.createElement("i");
			const chain = TOKENS[part].reduceRight(
				(inner, token) => `var(${token}, ${inner})`,
				fallback[part],
			);
			swatch.style.backgroundColor = chain;
			probe.append(swatch);
			return [part, swatch];
		}),
	) as Record<keyof Thumb, HTMLElement>;
	document.body.append(probe);
	const thumb = Object.fromEntries(
		Object.entries(swatches).map(([part, el]) => [part, getComputedStyle(el).backgroundColor]),
	) as Thumb;
	probe.remove();
	return thumb;
}

const community = new Map<string, Promise<Thumb | null>>();

/** A community theme's thumbnail, from its stylesheet: fetched once a session, when first asked for. */
export function communityThumb(repo: string, mode: "light" | "dark"): Promise<Thumb | null> {
	let pending = community.get(repo);
	if (!pending) {
		pending = fetchCommunityCSS(repo)
			.then((css) => resolveCss(css, mode))
			.catch(() => null);
		community.set(repo, pending);
	}
	return pending;
}
