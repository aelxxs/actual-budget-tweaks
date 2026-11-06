import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

const source = await readFile(new URL("../src/lib/utilities/calc.ts", import.meta.url), "utf8");
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => {
	throw new Error("calc.ts should have no imports");
});
await module.evaluate();
const { calculate } = module.namespace;

test("does arithmetic in the right order", () => {
	assert.equal(calculate("145.20 * 12"), 1742.4);
	assert.equal(calculate("2 + 3 * 4"), 14);
	assert.equal(calculate("(2 + 3) * 4"), 20);
	assert.equal(calculate("10 / 4"), 2.5);
	assert.equal(calculate("2 ^ 3 ^ 2"), 512);
	assert.equal(calculate("-5 + 3"), -2);
});

test("reads the ways money gets typed", () => {
	assert.equal(calculate("$1,250.50 + $49.50"), 1300);
	assert.equal(calculate("3 × 4 ÷ 2"), 6);
	assert.equal(calculate("3x4"), 12);
});

test("percentages work as on a calculator", () => {
	assert.equal(calculate("200 + 10%"), 220);
	assert.equal(calculate("200 - 10%"), 180);
	assert.equal(calculate("200 * 15%"), 30);
	assert.equal(calculate("15%"), 0.15);
});

test("hides floating point noise", () => {
	assert.equal(calculate("0.1 + 0.2"), 0.3);
});

test("ignores anything that isn't a calculation", () => {
	for (const text of [
		"",
		"2026",
		"-5",
		"Cash Rewards",
		"401(K)",
		"1 +",
		"(2 + 3",
		"1 / 0",
		"a * b",
	]) {
		assert.equal(calculate(text), null, text);
	}
});
