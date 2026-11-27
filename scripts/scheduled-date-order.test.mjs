import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

const source = await readFile(
	new URL("../src/features/workflows/scheduled-date-order/data.ts", import.meta.url),
	"utf8",
);
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => {
	throw new Error("data.ts should have no runtime imports");
});
await module.evaluate();
const { interleaveScheduled } = module.namespace;

const tx = (id, date, amount, parent_id) => ({ id, date, amount, parent_id });
const ids = (rows) => rows.map((r) => r.id);

// Actual's own list: scheduled on top (newest first), then the rest by date, newest first.
const scheduled15 = tx("preview/a/2026-12-15", "2026-12-15", -5000);
const scheduled01 = tx("preview/b/2026-12-01", "2026-12-01", -2000);
const real05 = tx("r05", "2026-12-05", -1000);
const real20 = tx("r20", "2026-11-20", -300);
const actualDesc = [scheduled15, scheduled01, real05, real20];
// Running balances as Actual gives them: real ones exclude scheduled, scheduled stack on top.
const actualBalances = {
	r20: 10000,
	r05: 9000,
	"preview/b/2026-12-01": 7000,
	"preview/a/2026-12-15": 2000,
};

test("newest first, scheduled transactions move in among the others by date", () => {
	const { rows } = interleaveScheduled(actualDesc, null, "desc");
	assert.deepEqual(ids(rows), ["preview/a/2026-12-15", "r05", "preview/b/2026-12-01", "r20"]);
});

test("oldest first, the same order reversed", () => {
	const asc = [scheduled15, scheduled01, real20, real05];
	const { rows } = interleaveScheduled(asc, null, "asc");
	assert.deepEqual(ids(rows), ["r20", "preview/b/2026-12-01", "r05", "preview/a/2026-12-15"]);
});

test("running balances follow the new order", () => {
	const { balances } = interleaveScheduled(actualDesc, actualBalances, "desc");
	assert.deepEqual(balances, {
		r20: 10000,
		"preview/b/2026-12-01": 8000,
		r05: 7000,
		"preview/a/2026-12-15": 2000,
	});
	const asc = interleaveScheduled(
		[scheduled15, scheduled01, real20, real05],
		actualBalances,
		"asc",
	);
	assert.deepEqual(asc.balances, balances);
});

test("on the same day a scheduled transaction stays above (newest first) or below (oldest first)", () => {
	const same = tx("preview/c/2026-12-05", "2026-12-05", -1);
	assert.deepEqual(ids(interleaveScheduled([same, real05, real20], null, "desc").rows), [
		"preview/c/2026-12-05",
		"r05",
		"r20",
	]);
	assert.deepEqual(ids(interleaveScheduled([same, real20, real05], null, "asc").rows), [
		"r20",
		"r05",
		"preview/c/2026-12-05",
	]);
});

test("a split's children move with their parent", () => {
	const parent = tx("preview/s/2026-12-01", "2026-12-01", -2000);
	const childA = tx("preview/s/2026-12-01/a", "2026-12-01", -1500, parent.id);
	const childB = tx("preview/s/2026-12-01/b", "2026-12-01", -500, parent.id);
	const realParent = tx("rp", "2026-12-05", -100);
	const realChild = tx("rc", "2026-12-05", -100, "rp");
	const { rows } = interleaveScheduled(
		[parent, childA, childB, realParent, realChild],
		null,
		"desc",
	);
	assert.deepEqual(ids(rows), ["rp", "rc", parent.id, childA.id, childB.id]);
});

test("a list with nothing scheduled comes back as it was", () => {
	const rows = [real05, real20];
	const balances = { r05: 1, r20: 2 };
	const out = interleaveScheduled(rows, balances, "desc");
	assert.equal(out.rows, rows);
	assert.equal(out.balances, balances);
});

test("with no balance for any other transaction, Actual's balances stay", () => {
	const balances = { "preview/b/2026-12-01": 7000, "preview/a/2026-12-15": 2000 };
	const out = interleaveScheduled([scheduled15, scheduled01], balances, "desc");
	assert.equal(out.balances, balances);
});
