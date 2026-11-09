/*
 * Turns a theme recipe into the palette ABT themes are built from. Colors are worked out in
 * OKLCH, so equal lightness steps look equal across hues. No imports, so the unit test loads it.
 */

export type Mode = "dark" | "light";
export type Family = "close" | "opposite" | "rainbow" | "custom";
export type BudgetTone = "vivid" | "muted";
export type SidebarStyle = "match" | "deeper" | "dark" | "tinted";
export type GrainSize = "fine" | "medium" | "coarse";

/** A glow light, placed in fractions of the window. `color` is "accent", "second" or a hex. */
export type GlowLight = { x: number; y: number; size: number; strength: number; color: string };

export type Recipe = {
	name: string;
	mode: Mode;
	baseHue: number;
	/** 0 is grey, 1 the most tinted background. */
	tint: number;
	accentHue: number;
	accentChroma: number;
	family: Family;
	/** The links' hue when the family is "custom"; the chart colours sit around it. */
	linkHue?: number;
	budget: BudgetTone;
	/** 0 soft to 1 crisp. */
	contrast: number;
	/** Shifts every background's lightness (OKLCH L) from the studio's default; see DEPTH_RANGE. */
	depth?: number;
	/** Shifts the accent's lightness from the one the mode and contrast give; see LIFT_RANGE. */
	accentLift?: number;
	sidebar: SidebarStyle;
	/** The background's hue kept on the accent's, or opposite it, as the accent turns. */
	backgroundLink?: "accent" | "opposite" | null;
	glow: { on: boolean; lights: GlowLight[] };
	/** Amount 0 is off. */
	grain: { amount: number; size: GrainSize };
};

export type SidebarColors = {
	bg: string;
	text: string;
	sub: string;
	hover: string;
	sel: string;
	neg: string;
	/** Gains and warnings in ABT's sidebar tiles, readable on this background. */
	pos: string;
	warn: string;
};

export type Generated = {
	/** Keyed by the palette's names (text, mantle, mauve...), as hex. */
	colors: Record<string, string>;
	sidebar: SidebarColors;
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const encode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const decode = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));

function oklchToLinear(L: number, C: number, h: number): [number, number, number] {
	const a = C * Math.cos((h * Math.PI) / 180);
	const b = C * Math.sin((h * Math.PI) / 180);
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** The most chroma a screen can show at this lightness and hue. */
export function maxChroma(L: number, h: number, ceiling = 0.4, steps = 14): number {
	let lo = 0;
	let hi = ceiling;
	for (let i = 0; i < steps; i++) {
		const mid = (lo + hi) / 2;
		if (inGamut(oklchToLinear(L, mid, h))) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	return lo;
}

/** sRGB 0-255, with chroma pulled in until the color fits on screen. */
export function oklchToRgb(L: number, C: number, h: number): [number, number, number] {
	L = clamp(L, 0, 1);
	C = Math.max(0, C);
	let rgb = oklchToLinear(L, C, h);
	if (!inGamut(rgb)) {
		rgb = oklchToLinear(L, maxChroma(L, h, C), h);
	}
	return rgb.map((v) => Math.round(clamp(encode(clamp(v, 0, 1)), 0, 1) * 255)) as [
		number,
		number,
		number,
	];
}

export function oklchToHex(L: number, C: number, h: number): string {
	return (
		"#" +
		oklchToRgb(L, C, h)
			.map((v) => v.toString(16).padStart(2, "0"))
			.join("")
	);
}

function hexChannels(hex: string): [number, number, number] {
	return [1, 3, 5].map((i) => decode(parseInt(hex.slice(i, i + 2), 16) / 255)) as [
		number,
		number,
		number,
	];
}

export function hexToOklch(hex: string): { L: number; C: number; h: number } {
	const [r, g, b] = hexChannels(hex);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
	const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
	return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
	const lum = (hex: string) => {
		const [r, g, bl] = hexChannels(hex);
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const x = lum(a);
	const y = lum(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The least contrast against any of the backgrounds. */
function worstRatio(fg: string, bg: string | string[]): number {
	return Math.min(...[bg].flat().map((b) => contrastRatio(fg, b)));
}

/** Steps lightness away from the backgrounds until the color reaches the target on all of them. */
function readable(
	L: number,
	C: number,
	h: number,
	bg: string | string[],
	target: number,
	dir: 1 | -1,
) {
	let out = oklchToHex(L, C, h);
	for (let i = 0; i < 60 && worstRatio(out, bg) < target && L > 0 && L < 1; i++) {
		L += 0.01 * dir;
		out = oklchToHex(L, C, h);
	}
	return out;
}

function lerpHue(a: number, b: number, t: number): number {
	const d = ((b - a + 540) % 360) - 180;
	return (a + d * t + 360) % 360;
}

/** The accent's lightness; the color wheel is drawn at the middle contrast. */
export function accentLightness(mode: Mode, contrast: number): number {
	return mode === "dark" ? 0.66 + 0.06 * contrast : 0.53 - 0.06 * contrast;
}

export const CHROMA_CEILING = 0.26;

/** How far the backgrounds can move: a dark theme mostly lighter (dim), a light one darker. */
export const DEPTH_RANGE: Record<Mode, [number, number]> = {
	dark: [-0.04, 0.1],
	light: [-0.1, 0.01],
};
export const LIFT_RANGE: [number, number] = [-0.1, 0.12];

/**
 * The accent brightnesses the contrast guard leaves alone, as [lowest, highest] lift: outside
 * them it moves the accent back to 4.5:1 against the backgrounds, so the setting does nothing.
 */
export function readableLift(r: Recipe, colors: Record<string, string>): [number, number] {
	const rest = accentLightness(r.mode, r.contrast);
	const bgs = [colors.crust, colors.mantle, colors.base];
	const ok: number[] = [];
	for (let lift = LIFT_RANGE[0]; lift <= LIFT_RANGE[1] + 1e-9; lift += 0.005) {
		const hex = oklchToHex(rest + lift, r.accentChroma, r.accentHue);
		if (Math.min(...bgs.map((b) => contrastRatio(hex, b))) >= 4.5) {
			ok.push(lift);
		}
	}
	return ok.length ? [ok[0], ok[ok.length - 1]] : [0, 0];
}

/** The wheel's rim: the most vivid accent a screen shows for this hue. */
export function rimChroma(mode: Mode, hue: number): number {
	return maxChroma(accentLightness(mode, 0.5), hue, CHROMA_CEILING, 12);
}

export function familyHues(r: Pick<Recipe, "accentHue" | "family" | "linkHue">): number[] {
	const A = r.accentHue;
	const L = r.linkHue ?? A + 180;
	const hues = {
		close: [A - 35, A - 55, A - 75, A + 35],
		opposite: [A + 180, A + 160, A + 200, A + 140],
		// With the accent, five hues evenly round the wheel.
		rainbow: [A + 72, A + 144, A + 216, A + 288],
		custom: [L, L - 15, L + 20, L - 35],
	}[r.family];
	return hues.map((h) => (h + 360) % 360);
}

/** A picked hue or a rainbow keeps some colour even beside a near-grey accent. */
export function familyChroma(r: Pick<Recipe, "accentChroma" | "family">): number {
	const vivid = r.family === "rainbow" || r.family === "custom";
	return vivid ? Math.max(0.11, r.accentChroma * 0.85) : r.accentChroma * 0.85;
}

/**
 * A starting recipe for a palette made elsewhere: the background's hue, tint and lightness, the
 * accent's hue and vibrance, and the links' hue, read back through the generator's own scales.
 */
export function recipeFromPalette(keys: Record<string, string>, name: string): Recipe {
	const at = (key: string) => hexToOklch(keys[`--ctp-${key}`] ?? "#808080");
	const mantle = at("mantle");
	const crust = at("crust");
	const accent = at("mauve");
	const link = at("blue");
	const mode: Mode = mantle.L < 0.5 ? "dark" : "light";
	const dark = mode === "dark";
	const tint = clamp(dark ? (mantle.C - 0.004) / 0.03 : (mantle.C - 0.003) / 0.02, 0, 1);
	// Contrast from how far apart the page and the cards sit, then the shift that puts them there.
	const gap = mantle.L - crust.L;
	const contrast = clamp(dark ? (gap - 0.022) / 0.008 : (gap - 0.022) / 0.01, 0, 1);
	const depth = dark
		? crust.L - (0.165 - 0.03 * contrast)
		: mantle.L + 0.02 + 0.01 * contrast - (0.985 - 0.012 * tint);
	const lift = accent.L - accentLightness(mode, contrast);
	return {
		name,
		mode,
		// A near-grey background's hue is noise, so it follows the accent instead.
		baseHue: mantle.C < 0.004 ? accent.h : mantle.h,
		tint,
		accentHue: accent.h,
		accentChroma: Math.max(0.02, Math.min(accent.C, rimChroma(mode, accent.h))),
		family: "custom",
		linkHue: link.h,
		budget: "vivid",
		contrast,
		depth: clamp(depth, ...DEPTH_RANGE[mode]),
		accentLift: clamp(lift, ...LIFT_RANGE),
		sidebar: "match",
		backgroundLink: null,
		glow: { on: false, lights: [] },
		grain: { amount: 0, size: "fine" },
	};
}

export const FAMILY_KEYS = ["blue", "sapphire", "sky", "teal"] as const;

// Hue, vivid chroma, then lightness in dark and in light themes.
const BUDGET_COLORS: Record<string, [number, number, number, number]> = {
	red: [25, 0.17, 0.72, 0.55],
	maroon: [15, 0.14, 0.66, 0.5],
	peach: [55, 0.15, 0.76, 0.6],
	yellow: [90, 0.14, 0.86, 0.66],
	green: [150, 0.15, 0.76, 0.55],
};

export function generate(r: Recipe): Generated {
	const dark = r.mode === "dark";
	// Clamped here as well, so a shift set in one mode can't push the other off its scale.
	const depth = clamp(r.depth ?? 0, ...DEPTH_RANGE[r.mode]);
	const c = r.contrast;
	const t = r.tint;
	const H = r.baseHue;
	const dir = dark ? 1 : -1;
	const K: Record<string, string> = {};
	const put = (key: string, L: number, C: number, h = H) => {
		K[key] = oklchToHex(L, C, h);
	};

	let crustL: number;
	let mantleL: number;
	const surfaces = () => [K.crust, K.mantle, K.base];
	// Muted text: placeholders at 3:1, but overlay1 is also the budgeted figures, so 4.5:1.
	const guardOverlays = (L: number, C: number, d: 1 | -1) => {
		K.overlay0 = readable(L, C, H, surfaces(), 4.5, d);
		K.overlay1 = readable(L + 0.06 * d, C, H, surfaces(), 5, d);
		K.overlay2 = readable(L + 0.12 * d, C * 0.95, H, surfaces(), 5.5, d);
	};
	if (dark) {
		// Even full tint stays where real themes sit: a hint of hue, not a colored page.
		const cs = 0.004 + 0.03 * t;
		const ct = 0.004 + 0.02 * t;
		crustL = 0.165 - 0.03 * c + depth;
		mantleL = crustL + 0.022 + 0.008 * c;
		const baseL = mantleL + 0.022 + 0.008 * c;
		const s0 = baseL + 0.045 + 0.02 * c;
		put("crust", crustL, cs);
		put("mantle", mantleL, cs);
		put("base", baseL, cs);
		put("surface0", s0, cs * 0.95);
		put("surface1", s0 + 0.045, cs * 0.9);
		put("surface2", s0 + 0.09, cs * 0.85);
		guardOverlays(0.5, cs * 0.7, 1);
		// Secondary text moves with the backgrounds, keeping its distance from them.
		put("subtext0", 0.66 + 0.09 * c + depth, ct * 1.2);
		put("subtext1", 0.76 + 0.07 * c + depth, ct * 1.1);
		K.text = readable(0.88 + 0.07 * c, ct, H, K.mantle, 7, 1);
	} else {
		const cs = 0.003 + 0.02 * t;
		const ct = 0.006 + 0.03 * t;
		const baseL = Math.min(1, 0.985 - 0.012 * t + depth);
		mantleL = baseL - 0.02 - 0.01 * c;
		crustL = mantleL - 0.022 - 0.01 * c;
		const s0 = crustL - 0.05 - 0.02 * c;
		put("base", baseL, cs * 0.7);
		put("mantle", mantleL, cs);
		put("crust", crustL, cs * 1.1);
		put("surface0", s0, cs * 1.1);
		put("surface1", s0 - 0.045, cs * 1.1);
		put("surface2", s0 - 0.09, cs * 1.1);
		guardOverlays(0.7, cs * 1.2, -1);
		put("subtext0", 0.55 - 0.1 * c + depth, ct);
		put("subtext1", 0.46 - 0.08 * c + depth, ct);
		K.text = readable(0.33 - 0.1 * c, ct, H, K.mantle, 7, -1);
	}

	const A = r.accentHue;
	const AC = r.accentChroma;
	const aL = accentLightness(r.mode, c) + (r.accentLift ?? 0);
	// 4.5:1 both as text and as a fill under page-colored text (buttons, pills, tags).
	K.mauve = readable(aL, AC, A, surfaces(), 4.5, dir);
	K.lavender = oklchToHex(aL - (dark ? 0.04 : 0.05), AC * 0.95, A + 12);
	put("pink", Math.min(0.94, aL + (dark ? 0.04 : 0.06)), AC * 0.8, A + 25);
	put("flamingo", Math.min(0.95, aL + (dark ? 0.08 : 0.12)), AC * 0.55, A + 40);
	put("rosewater", Math.min(0.96, aL + (dark ? 0.12 : 0.18)), AC * 0.35, A + 50);

	const hues = familyHues(r);
	const fc = familyChroma(r);
	FAMILY_KEYS.forEach((key, i) => {
		K[key] = readable(aL + [-0.02, 0, 0.04, 0.02][i], fc, hues[i], surfaces(), 4.5, dir);
	});

	for (const [key, [h, chroma, darkL, lightL]] of Object.entries(BUDGET_COLORS)) {
		const muted = r.budget === "muted";
		const hue = muted ? lerpHue(h, H, 0.22 * t) : h;
		// Clearly calmer, not just a touch softer: about a third of the saturation.
		const C = muted ? chroma * 0.35 : chroma;
		// surface0 too: it's the sidebar's hover when the sidebar matches the page.
		const bgs = [...surfaces(), K.surface0];
		K[key] = readable(dark ? darkL + 0.03 * c : lightL - 0.04 * c, C, hue, bgs, 4.5, dir);
	}

	return { colors: K, sidebar: sidebarColors(r, K, crustL, mantleL) };
}

function sidebarColors(
	r: Recipe,
	K: Record<string, string>,
	crustL: number,
	mantleL: number,
): SidebarColors {
	const s = sidebarBase(r, K, crustL, mantleL);
	if (r.sidebar === "match") {
		return { ...s, pos: K.green, warn: K.yellow };
	}
	const up = hexToOklch(s.bg).L < 0.55;
	const tone = (h: number, C: number) =>
		readable(up ? 0.78 : 0.5, C, h, [s.bg, s.hover], 4.5, up ? 1 : -1);
	return { ...s, pos: tone(150, 0.15), warn: tone(85, 0.14) };
}

function sidebarBase(
	r: Recipe,
	K: Record<string, string>,
	crustL: number,
	mantleL: number,
): Omit<SidebarColors, "pos" | "warn"> {
	const dark = r.mode === "dark";
	const t = r.tint;
	const H = r.baseHue;
	const dir = dark ? 1 : -1;
	if (r.sidebar === "match") {
		return {
			bg: K.mantle,
			text: K.text,
			sub: K.subtext0,
			hover: K.surface0,
			sel: K.mauve,
			neg: K.red,
		};
	}
	if (r.sidebar === "deeper") {
		const l = dark ? crustL - 0.03 : crustL - 0.035;
		const bg = oklchToHex(l, 0.004 + 0.03 * t, H);
		const hover = oklchToHex(l + 0.05 * dir, 0.004 + 0.027 * t, H);
		return {
			bg,
			hover,
			text: K.text,
			sub: readable(dark ? 0.72 : 0.48, 0.01 + 0.02 * t, H, [bg, hover], 4.5, dir),
			sel: readable(dark ? 0.75 : 0.5, r.accentChroma, r.accentHue, bg, 4.5, dir),
			neg: readable(dark ? 0.72 : 0.5, 0.16, 25, [bg, hover], 4.5, dir),
		};
	}
	if (r.sidebar === "dark") {
		// In a dark theme "Deeper" is already dark, so this one goes to near black.
		const l = dark ? 0.06 : 0.235 - 0.03 * r.contrast;
		const bg = oklchToHex(l, dark ? 0.003 + 0.008 * t : 0.008 + 0.02 * t, H);
		return {
			bg,
			hover: oklchToHex(l + 0.06, 0.01 + 0.02 * t, H),
			text: oklchToHex(0.94, 0.008 + 0.01 * t, H),
			sub: readable(0.72, 0.01 + 0.015 * t, H, bg, 4.5, 1),
			sel: readable(0.78, r.accentChroma, r.accentHue, bg, 4.5, 1),
			neg: readable(0.74, 0.15, 25, bg, 4.5, 1),
		};
	}
	if (!dark) {
		// A pale accent wash reads as pastel, so a light theme's tinted sidebar is a deep accent.
		const l = 0.34 - 0.04 * r.contrast;
		const chroma = Math.min(0.1, Math.max(0.05, r.accentChroma * 0.6));
		const bg = oklchToHex(l, chroma, r.accentHue);
		return {
			bg,
			hover: oklchToHex(l + 0.06, chroma, r.accentHue),
			text: oklchToHex(0.96, 0.01, r.accentHue),
			sub: readable(0.78, chroma * 0.4, r.accentHue, bg, 4.5, 1),
			sel: readable(0.86, r.accentChroma * 0.6, r.accentHue, bg, 4.5, 1),
			neg: readable(0.78, 0.15, 25, bg, 4.5, 1),
		};
	}
	const l = mantleL + 0.01;
	const chroma = Math.min(0.11, Math.max(0.035, r.accentChroma * 0.35));
	const bg = oklchToHex(l, chroma, r.accentHue);
	return {
		bg,
		hover: oklchToHex(l + 0.05, chroma * 1.1, r.accentHue),
		text: K.text,
		sub: readable(0.72, chroma * 0.5, r.accentHue, bg, 4.5, 1),
		sel: readable(0.8, r.accentChroma, r.accentHue, bg, 4.5, 1),
		neg: readable(0.72, 0.16, 25, bg, 4.5, 1),
	};
}

/** Palette keys, or "sidebar.<key>" for the sidebar's own colors. */
type ContrastPair = { label: string; fg: string; bg: string[]; min: number };

// The text/background pairs Actual draws with these colors (see theme-apply's mapping).
const CARDS = ["mantle", "base", "crust"];
const CONTRAST_PAIRS: ContrastPair[] = [
	{ label: "Text", fg: "text", bg: [...CARDS, "surface0"], min: 4.5 },
	{ label: "Secondary text", fg: "subtext0", bg: CARDS, min: 4.5 },
	{ label: "Buttons and menu items", fg: "subtext1", bg: [...CARDS, "surface0"], min: 4.5 },
	{ label: "Budgeted amounts", fg: "overlay1", bg: CARDS, min: 4.5 },
	{ label: "Muted text", fg: "overlay0", bg: CARDS, min: 4.5 },
	{ label: "Overspent", fg: "red", bg: CARDS, min: 4.5 },
	{ label: "Available", fg: "green", bg: CARDS, min: 4.5 },
	{ label: "Warnings", fg: "yellow", bg: CARDS, min: 4.5 },
	{ label: "Links", fg: "blue", bg: CARDS, min: 4.5 },
	{ label: "Accent text", fg: "mauve", bg: CARDS, min: 4.5 },
	{ label: "Text on accent buttons", fg: "base", bg: ["mauve"], min: 4.5 },
	{ label: "Text on primary buttons", fg: "crust", bg: ["lavender"], min: 4.5 },
	{ label: "Text on menu highlight", fg: "crust", bg: ["yellow"], min: 4.5 },
	{ label: "Sidebar text", fg: "sidebar.text", bg: ["sidebar.bg", "sidebar.hover"], min: 4.5 },
	{
		label: "Sidebar secondary text",
		fg: "sidebar.sub",
		bg: ["sidebar.bg", "sidebar.hover"],
		min: 4.5,
	},
	{ label: "Sidebar selected item", fg: "sidebar.sel", bg: ["sidebar.bg"], min: 4.5 },
	{ label: "Sidebar losses", fg: "sidebar.neg", bg: ["sidebar.bg", "sidebar.hover"], min: 4.5 },
	{ label: "Sidebar gains", fg: "sidebar.pos", bg: ["sidebar.bg", "sidebar.hover"], min: 4.5 },
	{ label: "Sidebar warnings", fg: "sidebar.warn", bg: ["sidebar.bg", "sidebar.hover"], min: 4.5 },
];

export type ContrastCheck = {
	label: string;
	ratio: number;
	min: number;
	passes: boolean;
	/** The colors of the weakest combination, for a sample. */
	fg: string;
	bg: string;
};
export type ContrastReport = { checks: ContrastCheck[]; failing: ContrastCheck[]; passes: boolean };

/** Every text color against each background it's drawn on; AA for normal-size text is 4.5:1. */
export function contrastReport(g: Generated): ContrastReport {
	const color = (key: string) =>
		key.startsWith("sidebar.") ? g.sidebar[key.slice(8) as keyof SidebarColors] : g.colors[key];
	const checks = CONTRAST_PAIRS.map(({ label, fg, bg, min }) => {
		const fore = color(fg);
		const [ratio, back] = bg
			.map((b) => [contrastRatio(fore, color(b)), color(b)] as const)
			.reduce((a, b) => (b[0] < a[0] ? b : a));
		return { label, ratio, min, passes: ratio >= min, fg: fore, bg: back };
	});
	const failing = checks.filter((c) => !c.passes);
	return { checks, failing, passes: failing.length === 0 };
}

/** The least contrast at or above the recipe's that passes AA. */
export function contrastToPass(r: Recipe): number {
	let best = r.contrast;
	let fewest = Infinity;
	for (let c = r.contrast; c <= 1; c = Math.round((c + 0.02) * 100) / 100) {
		const failing = contrastReport(generate({ ...r, contrast: c })).failing.length;
		if (failing === 0) {
			return c;
		}
		// When nothing passes, the least contrast with the fewest failures.
		if (failing < fewest) {
			best = c;
			fewest = failing;
		}
	}
	return best;
}

const GRAIN_FREQUENCY: Record<GrainSize, number> = { fine: 0.95, medium: 0.62, coarse: 0.38 };

/**
 * Opaque noise centred on mid-grey, for an overlay blend: it lightens and darkens equally, so a
 * theme's brightness stays put. The amount sets its contrast; the size its frequency.
 */
export function grainImage(amount: number, size: GrainSize): string {
	const k = (amount / 100).toFixed(3);
	const o = ((1 - amount / 100) / 2).toFixed(3);
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${GRAIN_FREQUENCY[size]}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='${k} 0 0 0 ${o} ${k} 0 0 0 ${o} ${k} 0 0 0 ${o} 0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function lightColor(light: GlowLight, colors: Record<string, string>): string {
	// Themes saved before the rename stored the field as `colour`.
	const color = light.color ?? (light as { colour?: string }).colour ?? "accent";
	if (color === "accent") {
		return colors.mauve;
	}
	if (color === "second") {
		return colors.sapphire;
	}
	return color;
}

/** One radial gradient per light, sized against a box of `width` by `height`. */
export function glowLayers(
	r: Recipe,
	colors: Record<string, string>,
	width: number | string,
	height: number | string,
): string[] {
	if (!r.glow.on) {
		return [];
	}
	const len = (box: number | string, f: number) =>
		typeof box === "number" ? `${Math.round(box * f)}px` : `calc(${box} * ${f.toFixed(3)})`;
	const light = r.mode === "light";
	/*
	 * On a light page a mid-tone light darkens it into a grey haze, so it's drawn as a pastel of
	 * its hue instead, which can only tint; a stronger mix makes up for the paler color.
	 */
	const tone = (hex: string) => {
		if (!light) {
			return hex;
		}
		const { C, h } = hexToOklch(hex);
		return oklchToHex(0.9, Math.min(0.12, C), h);
	};
	return r.glow.lights.map((l) => {
		const alpha = ((l.strength / 100) * (light ? 65 : 30)).toFixed(1);
		const color = `color-mix(in srgb, ${tone(lightColor(l, colors))} ${alpha}%, transparent)`;
		return `radial-gradient(circle ${len(width, l.size)} at ${len(width, l.x)} ${len(height, l.y)}, ${color}, transparent)`;
	});
}
