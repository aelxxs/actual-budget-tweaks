import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

const source = await readFile(new URL("../src/lib/format/initials.ts", import.meta.url), "utf8");
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => {
	throw new Error("initials.ts should have no imports");
});
await module.evaluate();
const { initials, nameEmoji } = module.namespace;

test("takes the first letter of the first two words", () => {
	assert.equal(initials("Joint checking"), "JC");
	assert.equal(initials("savings"), "SA");
	assert.equal(initials("savings", 1), "S");
});

test("never splits an emoji into a broken character", () => {
	assert.equal(initials("🏦 Checking"), "CH");
	assert.equal(initials("Rewards 💳"), "RE");
	assert.equal(initials("💳"), "");
	assert.equal(initials("Émile’s card"), "ÉC");
});

test("finds the emoji in a name, whole", () => {
	assert.equal(nameEmoji("🏦 Checking"), "🏦");
	assert.equal(nameEmoji("Rewards 💳"), "💳");
	assert.equal(nameEmoji("Family 👨‍👩‍👧 fund"), "👨‍👩‍👧");
	assert.equal(nameEmoji("Trip 🇯🇵"), "🇯🇵");
	assert.equal(nameEmoji("Checking"), undefined);
	assert.equal(nameEmoji("Card #2"), undefined);
});
