type Variable = `--${string}`;
type HEXColor = `#${string}`;

export interface Theme {
	name: string;
	mode: "dark" | "light";
	keys: Record<Variable, HEXColor>;
}
