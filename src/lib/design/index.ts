import { join } from "path";

import { cyberpunk } from "./palettes/cyberpunk";
import { dusk } from "./palettes/dusk";
import { forest } from "./palettes/forest";
import { frappe } from "./palettes/frappe";
import { ghibliTwilight } from "./palettes/ghibli-twilight";
import { gruvbox } from "./palettes/gruvbox";
import { latte } from "./palettes/latte";
import { macchiato } from "./palettes/macchiato";
import { material } from "./palettes/material";
import { midnight } from "./palettes/midnight";
import { mocha } from "./palettes/mocha";
import { nocturne } from "./palettes/nocturne";
import { nord } from "./palettes/nord";
import { obsidian } from "./palettes/obsidian";
import { sandstone } from "./palettes/sandstone";
import { tomorrowNight } from "./palettes/tomorrow-night";
import { velvet } from "./palettes/velvet";
import { Theme } from "./types";

export const defaultTheme = mocha;

export const themes: Record<string, Theme> = {
	cyberpunk,
	dusk,
	forest,
	frappe,
	ghibliTwilight,
	gruvbox,
	latte,
	macchiato,
	material,
	midnight,
	mocha,
	nocturne,
	nord,
	obsidian,
	sandstone,
	tomorrowNight,
	velvet,
};

export const getTheme = (key: string): Theme => {
	return themes[key as keyof typeof themes] ?? defaultTheme;
};

export const themeSelectOptions: { value: string; label: string }[] = Object.entries(themes).map(([key, theme]) => ({
	value: key,
	label: theme.name,
}));
