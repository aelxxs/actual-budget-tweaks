import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

const source = await readFile(
	new URL("../src/features/theme/studio/generator.ts", import.meta.url),
	"utf8",
);
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => {
	throw new Error("generator.ts should have no imports");
});
await module.evaluate();
const {
	generate,
	contrastReport,
	contrastRatio,
	hexToOklch,
	oklchToHex,
	contrastToPass,
	recipeFromPalette,
} = module.namespace;

const base = {
	name: "Test",
	mode: "dark",
	baseHue: 270,
	tint: 0.5,
	accentHue: 300,
	accentChroma: 0.15,
	family: "rainbow",
	budget: "vivid",
	contrast: 0.5,
	sidebar: "match",
	glow: { on: false, lights: [] },
	grain: { amount: 0, size: "fine" },
};

test("hex survives a round trip through OKLCH", () => {
	for (const hex of ["#1e1e2e", "#cba6f7", "#a6e3a1", "#ffffff", "#000000"]) {
		const { L, C, h } = hexToOklch(hex);
		assert.equal(oklchToHex(L, C, h), hex);
	}
});

test("every color is a six-digit hex, in both modes and every sidebar", () => {
	for (const mode of ["dark", "light"]) {
		for (const sidebar of ["match", "deeper", "dark", "tinted"]) {
			const g = generate({ ...base, mode, sidebar });
			assert.equal(Object.keys(g.colors).length, 27);
			for (const value of [...Object.values(g.colors), ...Object.values(g.sidebar)]) {
				assert.match(value, /^#[0-9a-f]{6}$/);
			}
		}
	}
});

test("borders match surface0 until raised, reach 3:1 at full, and ignore contrast", () => {
	for (const mode of ["dark", "light"]) {
		const off = generate({ ...base, mode, contrast: 1 }).colors;
		assert.equal(off.line, off.surface0);
		const full = generate({ ...base, mode, borders: 1 }).colors;
		assert.ok(
			contrastRatio(full.line, full.base) >= 3,
			`${mode}: ${contrastRatio(full.line, full.base)}`,
		);
	}
});

test("body text reads against the cards at any setting", () => {
	for (const mode of ["dark", "light"]) {
		for (const contrast of [0, 0.5, 1]) {
			for (const tint of [0, 1]) {
				const g = generate({ ...base, mode, contrast, tint });
				assert.ok(
					contrastRatio(g.colors.text, g.colors.mantle) >= 7,
					`${mode} ${contrast} ${tint}`,
				);
			}
		}
	}
});

test("budget figures stay legible on every surface", () => {
	for (const mode of ["dark", "light"]) {
		for (const budget of ["vivid", "muted"]) {
			const g = generate({ ...base, mode, budget });
			for (const key of ["red", "green", "yellow", "overlay1"]) {
				for (const bg of ["crust", "mantle", "base"]) {
					assert.ok(contrastRatio(g.colors[key], g.colors[bg]) >= 4.5, `${mode} ${key}/${bg}`);
				}
			}
		}
	}
});

test("more contrast spreads text further from the background", () => {
	const secondary = (contrast) =>
		contrastReport(generate({ ...base, contrast })).checks.find((c) => c.label === "Secondary text")
			.ratio;
	assert.ok(secondary(1) > secondary(0));
});

test("fixing contrast passes every pair, whatever the sidebar", () => {
	for (const mode of ["dark", "light"]) {
		for (const sidebar of ["match", "deeper", "dark", "tinted"]) {
			const r = { ...base, mode, sidebar, contrast: 0, tint: 1 };
			const report = contrastReport(generate({ ...r, contrast: contrastToPass(r) }));
			assert.ok(report.passes, `${mode} ${sidebar}: ${report.failing.map((c) => c.label)}`);
		}
	}
});

test("fixing contrast lands on a passing value", () => {
	const fixed = contrastToPass({ ...base, mode: "light", contrast: 0 });
	assert.ok(contrastReport(generate({ ...base, mode: "light", contrast: fixed })).passes);
});

test("a palette reads back to the recipe that made it", () => {
	const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
	for (const mode of ["dark", "light"]) {
		for (const tint of [0.2, 0.8]) {
			const made = {
				...base,
				mode,
				tint,
				family: "custom",
				linkHue: 180,
				depth: mode === "dark" ? 0.05 : -0.03,
				accentLift: mode === "dark" ? 0.06 : -0.04,
			};
			const keys = Object.fromEntries(
				Object.entries(generate(made).colors).map(([k, hex]) => [`--ctp-${k}`, hex]),
			);
			const back = recipeFromPalette(keys, "Back");
			const where = `${mode} tint ${tint}`;
			assert.equal(back.mode, mode, where);
			assert.ok(Math.abs(back.tint - tint) < 0.1, `${where}: tint ${back.tint}`);
			assert.ok(
				Math.abs(back.contrast - made.contrast) < 0.15,
				`${where}: contrast ${back.contrast}`,
			);
			assert.ok(hueGap(back.baseHue, made.baseHue) < 10, `${where}: base hue ${back.baseHue}`);
			assert.ok(
				hueGap(back.accentHue, made.accentHue) < 5,
				`${where}: accent hue ${back.accentHue}`,
			);
			assert.ok(hueGap(back.linkHue, 180) < 8, `${where}: link hue ${back.linkHue}`);
			assert.ok(Math.abs(back.depth - made.depth) < 0.015, `${where}: depth ${back.depth}`);
			assert.ok(
				Math.abs(back.accentLift - made.accentLift) < 0.03,
				`${where}: lift ${back.accentLift}`,
			);
		}
	}
});
