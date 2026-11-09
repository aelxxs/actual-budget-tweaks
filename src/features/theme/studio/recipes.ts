import type { GlowLight, GrainSize, Mode, Recipe } from "./generator";

/** What Shuffle can reroll, each lockable on its own. */
export type Trait = "mode" | "background" | "accent" | "palette" | "glow" | "grain";

export const TRAITS: { trait: Trait; label: string; title: string }[] = [
	{ trait: "mode", label: "Mode", title: "Light or dark, and contrast" },
	{ trait: "background", label: "Background", title: "Background color, shade and sidebar" },
	{ trait: "accent", label: "Accent", title: "Accent color" },
	{ trait: "palette", label: "Palette", title: "Link, chart and budget colors" },
	{ trait: "glow", label: "Glow", title: "Glow lights" },
	{ trait: "grain", label: "Grain", title: "Grain amount and size" },
];

const corner = (strength = 55, color = "accent"): GlowLight[] => [
	{ x: 0, y: 0, size: 0.55, strength, color },
	{ x: 1, y: 1, size: 0.42, strength: Math.round(strength * 0.375), color },
];

export const PRESETS: Recipe[] = [
	{
		name: "Midnight",
		mode: "dark",
		baseHue: 278,
		tint: 0.45,
		accentHue: 300,
		accentChroma: 0.15,
		family: "rainbow",
		budget: "vivid",
		contrast: 0.5,
		sidebar: "match",
		glow: { on: true, lights: corner(50) },
		grain: { amount: 20, size: "fine" },
	},
	{
		name: "Daylight",
		mode: "light",
		baseHue: 250,
		tint: 0.15,
		accentHue: 258,
		accentChroma: 0.16,
		family: "rainbow",
		budget: "vivid",
		contrast: 0.55,
		sidebar: "dark",
		glow: { on: false, lights: corner(40) },
		grain: { amount: 0, size: "fine" },
	},
	{
		name: "Forest",
		mode: "dark",
		baseHue: 150,
		tint: 0.6,
		accentHue: 92,
		accentChroma: 0.13,
		family: "close",
		budget: "muted",
		contrast: 0.45,
		sidebar: "deeper",
		glow: { on: true, lights: [{ x: 0.62, y: 0.08, size: 0.6, strength: 45, color: "accent" }] },
		grain: { amount: 30, size: "medium" },
	},
	{
		name: "Ember",
		mode: "dark",
		baseHue: 38,
		tint: 0.35,
		accentHue: 48,
		accentChroma: 0.17,
		family: "opposite",
		budget: "vivid",
		contrast: 0.6,
		sidebar: "match",
		glow: {
			on: true,
			lights: [
				{ x: 0, y: 1, size: 0.6, strength: 70, color: "accent" },
				{ x: 1, y: 0, size: 0.4, strength: 35, color: "second" },
			],
		},
		grain: { amount: 12, size: "fine" },
	},
	{
		name: "Paper",
		mode: "light",
		baseHue: 78,
		tint: 0.5,
		accentHue: 28,
		accentChroma: 0.12,
		family: "close",
		budget: "muted",
		contrast: 0.3,
		sidebar: "match",
		glow: { on: false, lights: corner(40) },
		grain: { amount: 50, size: "coarse" },
	},
	{
		name: "Harbor",
		mode: "light",
		baseHue: 220,
		tint: 0.4,
		accentHue: 198,
		accentChroma: 0.12,
		family: "opposite",
		budget: "vivid",
		contrast: 0.45,
		sidebar: "tinted",
		glow: { on: true, lights: [{ x: 0.5, y: -0.05, size: 0.65, strength: 50, color: "second" }] },
		grain: { amount: 0, size: "fine" },
	},
];

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const chance = (p: number) => Math.random() < p;
const anyHue = () => Math.floor(Math.random() * 360);
const wrap = (h: number) => ((h % 360) + 360) % 360;

function randomLights(strength: number, colors: string[] = ["accent"]): GlowLight[] {
	const s = Math.round(strength);
	const kind = pick(["corner", "top", "both", "loose"] as const);
	if (kind === "corner") {
		return corner(s, pick(colors));
	}
	if (kind === "top") {
		return [{ x: rnd(0.3, 0.7), y: -0.05, size: rnd(0.5, 0.7), strength: s, color: pick(colors) }];
	}
	if (kind === "both") {
		return [
			{ x: 0, y: 0, size: 0.5, strength: s, color: pick(colors) },
			{ x: 1, y: 1, size: 0.5, strength: Math.round(s * 0.8), color: pick(colors) },
		];
	}
	return Array.from({ length: pick([1, 2, 2, 3]) }, () => ({
		x: rnd(0, 1),
		y: rnd(0, 1),
		size: rnd(0.25, 0.55),
		strength: Math.round(s * rnd(0.6, 1)),
		color: pick(colors),
	}));
}

function grain(
	on: boolean,
	lo: number,
	hi: number,
	sizes: GrainSize[] = ["fine", "medium", "coarse"],
) {
	return { amount: on ? Math.round(rnd(lo, hi)) : 0, size: pick(sizes) };
}

type Draft = Omit<Recipe, "name" | "mode">;

/** A family of looks Shuffle draws from, so results differ in kind and not just in hue. */
type Style = { name: string; modes: Mode[]; make: () => Draft };

const STYLES: Style[] = [
	{
		name: "Monochrome",
		modes: ["dark", "light"],
		make: () => {
			const h = anyHue();
			return {
				baseHue: h,
				tint: rnd(0.55, 0.9),
				accentHue: wrap(h + rnd(-15, 15)),
				accentChroma: rnd(0.1, 0.15),
				family: "close",
				budget: chance(0.6) ? "muted" : "vivid",
				contrast: rnd(0.3, 0.7),
				sidebar: pick(["match", "deeper"] as const),
				glow: { on: chance(0.4), lights: randomLights(rnd(30, 60)) },
				grain: grain(chance(0.5), 10, 35),
			};
		},
	},
	{
		name: "Complementary",
		modes: ["dark", "light"],
		make: () => {
			const h = anyHue();
			return {
				baseHue: h,
				tint: rnd(0.1, 0.3),
				accentHue: wrap(h + 180 + rnd(-20, 20)),
				accentChroma: rnd(0.13, 0.17),
				family: "opposite",
				budget: "vivid",
				contrast: rnd(0.4, 0.8),
				sidebar: pick(["match", "tinted"] as const),
				glow: { on: chance(0.35), lights: randomLights(rnd(30, 55), ["accent", "second"]) },
				grain: grain(chance(0.3), 5, 25),
			};
		},
	},
	{
		name: "Neon night",
		modes: ["dark"],
		make: () => ({
			baseHue: anyHue(),
			tint: rnd(0.05, 0.3),
			accentHue: anyHue(),
			accentChroma: rnd(0.2, 0.26),
			family: pick(["rainbow", "opposite"] as const),
			budget: "vivid",
			contrast: rnd(0.75, 1),
			sidebar: pick(["deeper", "dark"] as const),
			glow: { on: true, lights: randomLights(rnd(60, 95), ["accent", "second"]) },
			grain: grain(chance(0.4), 5, 20, ["fine"]),
		}),
	},
	{
		name: "Paper",
		modes: ["light"],
		make: () => ({
			baseHue: rnd(55, 95),
			tint: rnd(0.35, 0.7),
			accentHue: wrap(pick([25, 50, 145, 230, 300]) + rnd(-8, 8)),
			accentChroma: rnd(0.09, 0.13),
			family: pick(["close", "rainbow"] as const),
			budget: "muted",
			contrast: rnd(0.2, 0.5),
			sidebar: pick(["match", "deeper"] as const),
			glow: { on: false, lights: corner(40) },
			grain: grain(true, 35, 70, ["medium", "coarse"]),
		}),
	},
	{
		name: "Pastel",
		modes: ["light"],
		make: () => ({
			baseHue: anyHue(),
			tint: rnd(0.5, 0.9),
			accentHue: anyHue(),
			accentChroma: rnd(0.08, 0.12),
			family: "rainbow",
			budget: "muted",
			contrast: rnd(0.15, 0.4),
			sidebar: pick(["tinted", "match"] as const),
			glow: { on: chance(0.6), lights: randomLights(rnd(35, 65), ["accent", "second"]) },
			grain: grain(chance(0.4), 5, 25),
		}),
	},
	{
		name: "Ink sidebar",
		modes: ["light"],
		make: () => ({
			baseHue: anyHue(),
			tint: rnd(0.05, 0.35),
			accentHue: anyHue(),
			accentChroma: rnd(0.14, 0.19),
			family: pick(["close", "opposite"] as const),
			budget: "vivid",
			contrast: rnd(0.5, 0.85),
			sidebar: "dark",
			glow: { on: chance(0.25), lights: randomLights(rnd(25, 45)) },
			grain: grain(chance(0.3), 5, 15, ["fine"]),
		}),
	},
	{
		name: "Deep tint",
		modes: ["dark"],
		make: () => {
			const h = anyHue();
			return {
				baseHue: h,
				tint: rnd(0.6, 0.9),
				accentHue: wrap(h + pick([-1, 1]) * rnd(40, 90)),
				accentChroma: rnd(0.12, 0.17),
				family: "close",
				budget: pick(["muted", "vivid"] as const),
				contrast: rnd(0.3, 0.7),
				sidebar: pick(["tinted", "deeper"] as const),
				glow: { on: chance(0.7), lights: randomLights(rnd(35, 70)) },
				grain: grain(true, 10, 40),
			};
		},
	},
	{
		name: "Graphite",
		modes: ["dark"],
		make: () => ({
			baseHue: anyHue(),
			tint: rnd(0, 0.12),
			accentHue: anyHue(),
			accentChroma: rnd(0.14, 0.18),
			family: "rainbow",
			budget: "vivid",
			contrast: rnd(0.5, 0.9),
			sidebar: pick(["match", "deeper", "dark"] as const),
			glow: { on: chance(0.35), lights: randomLights(rnd(30, 60)) },
			grain: grain(chance(0.6), 10, 40),
		}),
	},
];

let lastStyle: Style | null = null;

// The middle of Shade's range: deep to dim in dark themes, white to soft in light ones.
const SHUFFLE_DEPTH: Record<Mode, [number, number]> = { dark: [-0.03, 0.07], light: [-0.06, 0.01] };

/** Rerolls the unlocked traits from one style; the locked ones are kept as they are. */
export function shuffleRecipe(
	current: Recipe,
	locks: Partial<Record<Trait, boolean>> = {},
): Recipe {
	const fits = STYLES.filter((s) => !locks.mode || s.modes.includes(current.mode));
	let style = pick(fits);
	while (fits.length > 1 && style === lastStyle) {
		style = pick(fits);
	}
	lastStyle = style;
	const d = style.make();
	const next = copyRecipe(current);
	next.name = style.name;
	if (!locks.mode) {
		next.mode = pick(style.modes);
		next.contrast = d.contrast;
	}
	if (!locks.background) {
		next.baseHue = d.baseHue;
		next.tint = d.tint;
		next.sidebar = d.sidebar;
		next.backgroundLink = null;
		next.depth = d.depth ?? rnd(...SHUFFLE_DEPTH[next.mode]);
	}
	if (!locks.accent) {
		next.accentHue = d.accentHue;
		next.accentChroma = d.accentChroma;
		next.accentLift = d.accentLift;
	}
	if (!locks.palette) {
		next.family = d.family;
		next.budget = d.budget;
	}
	if (!locks.glow) {
		next.glow = d.glow;
	}
	if (!locks.grain) {
		next.grain = d.grain;
	}
	return followAccent(next);
}

/** Rerolls one trait and keeps everything else, the theme's name included. */
export function rerollTrait(current: Recipe, trait: Trait): Recipe {
	const locks = Object.fromEntries(TRAITS.map((t) => [t.trait, t.trait !== trait]));
	return { ...shuffleRecipe(current, locks), name: current.name };
}

/** A linked background takes its hue from the accent. */
export function followAccent(r: Recipe): Recipe {
	if (r.backgroundLink === "accent") {
		r.baseHue = r.accentHue;
	} else if (r.backgroundLink === "opposite") {
		r.baseHue = (r.accentHue + 180) % 360;
	}
	return r;
}

// Recipes come out of Svelte state as proxies, which structuredClone can't copy.
export function copyRecipe(r: Recipe): Recipe {
	return JSON.parse(JSON.stringify(r)) as Recipe;
}
