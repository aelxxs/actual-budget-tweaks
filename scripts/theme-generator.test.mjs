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
const { generate, contrastReport, contrastRatio, hexToOklch, oklchToHex, contrastToPass } =
	module.namespace;

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

test("every colour is a six-digit hex, in both modes and every sidebar", () => {
	for (const mode of ["dark", "light"]) {
		for (const sidebar of ["match", "deeper", "dark", "tinted"]) {
			const g = generate({ ...base, mode, sidebar });
			assert.equal(Object.keys(g.colours).length, 26);
			for (const value of [...Object.values(g.colours), ...Object.values(g.sidebar)]) {
				assert.match(value, /^#[0-9a-f]{6}$/);
			}
		}
	}
});

test("body text reads against the cards at any setting", () => {
	for (const mode of ["dark", "light"]) {
		for (const contrast of [0, 0.5, 1]) {
			for (const tint of [0, 1]) {
				const g = generate({ ...base, mode, contrast, tint });
				assert.ok(
					contrastRatio(g.colours.text, g.colours.mantle) >= 7,
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
					assert.ok(contrastRatio(g.colours[key], g.colours[bg]) >= 4.5, `${mode} ${key}/${bg}`);
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
