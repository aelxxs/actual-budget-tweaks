import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

const source = await readFile(
	new URL("../src/features/workflows/schedule-sort/data.ts", import.meta.url),
	"utf8",
);
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => {
	throw new Error("data.ts should have no runtime imports");
});
await module.evaluate();
const { nextOrder, orderExpressions, readOrder } = module.namespace;

test("clicking a column starts ascending, and clicking it again flips it", () => {
	const first = nextOrder(null, "name");
	assert.deepEqual(first, { column: "name", dir: "asc" });
	assert.deepEqual(nextOrder(first, "name"), { column: "name", dir: "desc" });
	assert.deepEqual(nextOrder(nextOrder(first, "name"), "name"), first);
	assert.deepEqual(nextOrder({ column: "name", dir: "desc" }, "next_date"), {
		column: "next_date",
		dir: "asc",
	});
});

test("names sort ignoring case, with each column breaking the other's ties", () => {
	assert.deepEqual(orderExpressions({ column: "name", dir: "desc" }), [
		{ $lower: "$name", $dir: "desc" },
		{ next_date: "asc" },
	]);
	assert.deepEqual(orderExpressions({ column: "next_date", dir: "asc" }), [
		{ next_date: "asc" },
		{ $lower: "$name", $dir: "asc" },
	]);
});

test("a stored value this version doesn't know reads as Actual's own order", () => {
	assert.equal(readOrder(undefined), null);
	assert.equal(readOrder(true), null);
	assert.equal(readOrder({ column: "amount", dir: "asc" }), null);
	assert.equal(readOrder({ column: "name", dir: "up" }), null);
	assert.deepEqual(readOrder({ column: "next_date", dir: "desc" }), {
		column: "next_date",
		dir: "desc",
	});
});
