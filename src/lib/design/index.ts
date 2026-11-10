import { cyberpunk } from "./palettes/cyberpunk";
import { daylight } from "./palettes/daylight";
import { frappe } from "./palettes/frappe";
import { ghibliTwilight } from "./palettes/ghibli-twilight";
import { latte } from "./palettes/latte";
import { macchiato } from "./palettes/macchiato";
import { midnight } from "./palettes/midnight";
import { mocha } from "./palettes/mocha";
import { monospaceMatrix } from "./palettes/monospace-matrix";
import { obsidian } from "./palettes/obsidian";
import { sandstone } from "./palettes/sandstone";
import { tomorrowNight } from "./palettes/tomorrow-night";
import { velvet } from "./palettes/velvet";
import { Theme } from "./types";

export const defaultTheme = mocha;

export const themes: Record<string, Theme> = {
	cyberpunk,
	daylight,
	frappe,
	ghibliTwilight,
	latte,
	macchiato,
	midnight,
	mocha,
	monospaceMatrix,
	obsidian,
	sandstone,
	tomorrowNight,
	velvet,
};

/** Order in the gallery, after Actual's own: the most distinct first, so the first row shows the range. */
export const FEATURED_THEMES = [
	"mocha",
	"latte",
	"midnight",
	"daylight",
	"velvet",
	"sandstone",
	"tomorrowNight",
	"monospaceMatrix",
	"cyberpunk",
	"obsidian",
	"macchiato",
	"frappe",
	"ghibliTwilight",
];

/** Built-in themes merged into a close one; saved choices move to it. */
export const RETIRED_THEMES: Record<string, string> = {
	dusk: "macchiato",
	material: "obsidian",
	nocturne: "midnight",
};

export const getTheme = (key: string): Theme => {
	return themes[RETIRED_THEMES[key] ?? key] ?? defaultTheme;
};

export const themeSelectOptions: { value: string; label: string }[] = Object.entries(themes).map(
	([key, theme]) => ({
		value: key,
		label: theme.name,
	}),
);
