import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule } from "node:vm";

const source = await readFile(
	new URL("../src/features/appearance/sidebar-shortcuts/rows.ts", import.meta.url),
	"utf8",
);
const module = new SourceTextModule(stripTypeScriptTypes(source));
await module.link(() => {
	throw new Error("rows.ts should have no runtime imports");
});
await module.evaluate();
const { dropLines, fits, pickSwap, pickTarget, placeTiles, previewLines, toLines, withExtras } =
	module.namespace;

const icon = (id, row) => ({ id, size: "small", url: `https://${id}`, row });
const ticker = (id, row) => ({ id, size: "half", url: "stock-tracker", row });
const rsu = (id, row) => ({ id, size: "half", url: "rsu-tracker", row });
const bills = (id, row) => ({ id, size: "wide", url: "upcoming-schedules", row });
const ids = (lines) => lines.map((line) => line.map((tile) => tile.id).join(" ")).join(" | ");

test("tiles with no saved rows keep flowing as they always did", () => {
	const items = ["a", "b", "c"].map((id) => icon(id));
	items.push(...["A", "B", "C", "D"].map((id) => ticker(id)), bills("bills"));
	assert.equal(ids(toLines(items, 242)), "a b c | A B | C D | bills");
	assert.equal(ids(toLines(items, 281)), "a b c A | B C | D | bills");
});

test("saved rows ignore the sidebar's width", () => {
	const items = [rsu("rsu", 0), ticker("stock", 1), icon("a", 1), icon("b", 1), icon("c", 1)];
	for (const width of [240, 281, 400, 516, 800]) {
		assert.equal(ids(toLines(items, width)), "rsu | stock a b c", `at ${width}px`);
	}
});

test("a row splits only when it physically can't fit", () => {
	const items = ["A", "B", "C"].map((id) => ticker(id, 0));
	assert.equal(ids(toLines(items, 240)), "A B | C");
	assert.equal(ids(toLines(items, 400)), "A B C");
});

test("tiles added after rows were saved go on the end", () => {
	const items = [ticker("A", 0), ticker("B", 1), icon("new")];
	assert.equal(ids(toLines(items, 242)), "A | B new");
});

test("tiles in a line share it evenly and small ones keep their size", () => {
	const placed = placeTiles(
		[
			[ticker("A"), ticker("B")],
			[ticker("C"), icon("a"), icon("b")],
		],
		242,
	);
	assert.equal(placed.get("A").width, 118);
	assert.equal(placed.get("B").left, 124);
	assert.equal(placed.get("C").width, 158);
	assert.deepEqual(placed.get("b"), { line: 1, left: 206, width: 36 });
});

test("the add button joins the last line only if it fits", () => {
	const add = { id: "add", size: "small", url: "" };
	assert.equal(ids(withExtras([[icon("a")]], [add], 242)), "a add");
	assert.equal(ids(withExtras([[bills("bills")]], [add], 242)), "bills | add");
});

test("only tiles that fit can join a line", () => {
	const line = [ticker("stock"), icon("a"), icon("b")];
	assert.equal(fits(line, icon("c"), 240), true);
	assert.equal(fits([...line, icon("c")], icon("d"), 240), false);
	assert.equal(fits([rsu("rsu")], ticker("stock"), 240), false);
});

const bands = [
	{
		top: 0,
		bottom: 36,
		tiles: [
			{ id: "rsu", center: 100 },
			{ id: "black", center: 218 },
		],
	},
	{
		top: 42,
		bottom: 78,
		tiles: [
			{ id: "stock", center: 79 },
			{ id: "a", center: 176 },
			{ id: "b", center: 218 },
		],
	},
];
const start = { kind: "join", line: 0, at: 1 };

test("a line's middle joins it, at the spot the pointer is over", () => {
	assert.deepEqual(pickTarget(bands, "black", 150, 60, start), { kind: "join", line: 1, at: 1 });
	assert.deepEqual(pickTarget(bands, "black", 230, 60, start), { kind: "join", line: 1, at: 3 });
});

test("edges and gaps start a new row", () => {
	assert.deepEqual(pickTarget(bands, "black", 100, 39, start), { kind: "new", gap: 1 });
	assert.deepEqual(pickTarget(bands, "black", 100, 90, start), { kind: "new", gap: 2 });
	assert.deepEqual(pickTarget(bands, "black", 100, -5, start), { kind: "new", gap: 0 });
});

test("a pointer wobbling on a boundary doesn't flicker", () => {
	const joined = { kind: "join", line: 1, at: 1 };
	assert.deepEqual(pickTarget(bands, "black", 178, 60, joined), joined);
	assert.deepEqual(pickTarget(bands, "black", 174, 60, { kind: "join", line: 1, at: 2 }), {
		kind: "join",
		line: 1,
		at: 2,
	});
	const fresh = { kind: "new", gap: 1 };
	assert.deepEqual(pickTarget(bands, "black", 100, 52, fresh), fresh);
});

test("dragging an icon into the row below gives the layout asked for", () => {
	const lines = [
		[rsu("rsu"), icon("black")],
		[ticker("stock"), icon("a"), icon("b")],
	];
	const target = { kind: "join", line: 1, at: 3 };
	assert.equal(ids(previewLines(lines, "black", target)), "rsu | stock a b black");
	const saved = dropLines(lines, "black", target);
	assert.deepEqual(
		saved.map((tile) => `${tile.id}:${tile.row}`),
		["rsu:0", "stock:1", "a:1", "b:1", "black:1"],
	);
});

test("a new row waits for the drop and empty rows are dropped", () => {
	const lines = [[icon("a")], [ticker("A"), ticker("B")]];
	const target = { kind: "new", gap: 2 };
	assert.equal(ids(previewLines(lines, "A", target)), "a | A B");
	assert.deepEqual(
		dropLines(lines, "a", { kind: "join", line: 1, at: 2 }).map((t) => `${t.id}:${t.row}`),
		["A:0", "B:0", "a:0"],
	);
	assert.deepEqual(
		dropLines(lines, "A", target).map((t) => `${t.id}:${t.row}`),
		["a:0", "B:1", "A:2"],
	);
});

test("dropping on a full row trades places with the tile under the pointer", () => {
	const lines = [
		[ticker("A"), ticker("B")],
		[ticker("C"), ticker("D")],
	];
	const band = {
		top: 42,
		bottom: 78,
		tiles: [
			{ id: "C", center: 59 },
			{ id: "D", center: 183 },
		],
	};
	const target = pickSwap(lines, band, "A", 200, 242, { kind: "join", line: 0, at: 0 });
	assert.deepEqual(target, { kind: "swap", with: "D" });
	assert.deepEqual(
		dropLines(lines, "A", target).map((t) => `${t.id}:${t.row}`),
		["D:0", "B:0", "C:1", "A:1"],
	);
	assert.deepEqual(pickSwap(lines, band, "A", 123, 242, target), target);
});

test("a swap that wouldn't fit is refused", () => {
	const lines = [
		[rsu("rsu"), icon("a")],
		[ticker("C"), ticker("D")],
	];
	const band = { top: 42, bottom: 78, tiles: [{ id: "C", center: 59 }] };
	const held = { kind: "join", line: 0, at: 1 };
	assert.equal(pickSwap(lines, band, "rsu", 60, 242, held), null);
});
