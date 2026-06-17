export const bgPatterns: Record<string, string> = {
	"Polka Dots":
		"background-color: var(--ctp-crust); background-image: radial-gradient(var(--ctp-surface0) 0.5px, var(--ctp-crust) 0.5px); background-size: 10px 10px;",
	"Polka Dots 2":
		"background-color: var(--ctp-crust); background-image: radial-gradient(var(--ctp-surface0) 0.5px, transparent 0.5px), radial-gradient(var(--ctp-surface0) 0.5px, var(--ctp-crust) 0.5px); background-size: 20px 20px; background-position: 0 0, 10px 10px;",
	"Diagonal Stripes":
		"background-color: var(--ctp-crust); background-size: 10px 10px; background-image: repeating-linear-gradient(45deg, var(--ctp-surface0) 0, var(--ctp-surface0) 1px, var(--ctp-crust) 0, var(--ctp-crust) 50%);",
	Cross: "background-color: var(--ctp-crust); background: radial-gradient(circle, transparent 20%, var(--ctp-crust) 20%, var(--ctp-crust) 80%, transparent 80%, transparent), radial-gradient(circle, transparent 20%, var(--ctp-crust) 20%, var(--ctp-crust) 80%, transparent 80%, transparent) 25px 25px, linear-gradient(var(--ctp-surface0) 2px, transparent 2px) 0 -1px, linear-gradient(90deg, var(--ctp-surface0) 2px, var(--ctp-crust) 2px) -1px 0; background-size: 50px 50px, 50px 50px, 25px 25px, 25px 25px;",
	None: "background: var(--color-pageBackground);",
};

export const BG_PATTERN_SELECTORS = `
:has([role="main"])
`;
