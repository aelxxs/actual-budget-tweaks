type Variable = `--${string}`;
type HEXColor = `#${string}`;

export interface Theme {
	name: string;
	mode: "dark" | "light";
	keys: Record<Variable, HEXColor>;
	/** Token overrides for this theme only, applied after the shared mapping. */
	css?: string;
}
