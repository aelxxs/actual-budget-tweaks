type Variable = `--${string}`;
type HEXColor = `#${string}`;

/**
 * What every palette theme paints from, built-in or made in Theme Studio. Besides the palette,
 * `--ctp-sidebar-*` give the sidebar its own colours and `--ctp-line` raises borders.
 */
export interface PaletteTheme {
	mode: "dark" | "light";
	keys: Record<string, string>;
}

export interface Theme extends PaletteTheme {
	name: string;
	keys: Record<Variable, HEXColor>;
}
