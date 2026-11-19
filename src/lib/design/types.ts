type Variable = `--${string}`;
type HEXColor = `#${string}`;

/**
 * What every palette theme paints from, built-in or made in Theme Studio: the `--ctp-*` palette,
 * plus optional roles of their own: `--theme-sidebar` and `--theme-sidebar-*` (a sidebar with its own
 * colours), `--theme-line` (raised borders), `--theme-chart-1..9` (charts), `--theme-data` (data).
 */
export interface PaletteTheme {
	mode: "dark" | "light";
	keys: Record<string, string>;
}

export interface Theme extends PaletteTheme {
	name: string;
	keys: Record<Variable, HEXColor>;
}
