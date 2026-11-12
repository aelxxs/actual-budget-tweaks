import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

const source = await readFile(
	new URL("../src/features/workflows/sync-recap/queue.ts", import.meta.url),
	"utf8",
);
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => {
	throw new Error("queue.ts should have no imports");
});
await module.evaluate();
const { emptyQueue, toQueue, pendingIds, withBatch, without, pruned } = module.namespace;

const DAY = 24 * 60 * 60 * 1000;

test("a sync adds a batch at the front", () => {
	let q = withBatch(emptyQueue(), ["a", "b"], 100);
	q = withBatch(q, ["c"], 200);
	assert.deepEqual(
		q.batches.map((b) => b.at),
		[200, 100],
	);
	assert.deepEqual(pendingIds(q), ["c", "a", "b"]);
});

test("ids already waiting stay in their first batch", () => {
	let q = withBatch(emptyQueue(), ["a", "b"], 100);
	q = withBatch(q, ["b", "c", "c"], 200);
	assert.deepEqual(q.batches[0], { at: 200, total: 1, pending: ["c"] });
	assert.deepEqual(q.batches[1].pending, ["a", "b"]);
});

test("a sync with nothing new leaves the queue as it was", () => {
	const q = withBatch(emptyQueue(), ["a"], 100);
	assert.equal(withBatch(q, ["a"], 200), q);
});

test("reviewing removes ids, and empty batches with them", () => {
	let q = withBatch(emptyQueue(), ["a", "b"], 100);
	q = withBatch(q, ["c"], 200);
	q = without(q, ["c", "a"]);
	assert.deepEqual(q.batches, [{ at: 100, total: 2, pending: ["b"] }]);
});

test("pruning drops missing transactions and batches past 30 days", () => {
	const now = 100 * DAY;
	let q = withBatch(emptyQueue(), ["old"], now - 31 * DAY);
	q = withBatch(q, ["kept", "deleted"], now - DAY);
	q = pruned(q, new Set(["old", "kept"]), now);
	assert.deepEqual(q.batches, [{ at: now - DAY, total: 2, pending: ["kept"] }]);
});

test("a stored queue is read back sorted, with anything malformed dropped", () => {
	const q = toQueue({
		version: 1,
		batches: [
			{ at: 1, total: 1, pending: ["a"] },
			{ at: 3, total: 2, pending: ["b"] },
			{ at: "bad", pending: ["c"] },
			{ at: 2, pending: [] },
			{ at: 4, pending: [5] },
		],
	});
	assert.deepEqual(
		q.batches.map((b) => b.at),
		[3, 1],
	);
	assert.deepEqual(toQueue(null), emptyQueue());
	assert.deepEqual(toQueue({ batches: "nope" }), emptyQueue());
});
