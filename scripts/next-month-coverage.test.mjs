import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";

const srcRoot = new URL("../src/", import.meta.url);
const sourceRoot = new URL("lib/actual/templates/", srcRoot);

// Resolves the bundler's aliases and relative imports from the module that asks for them.
function resolve(name, referrer) {
	if (name.startsWith("@lib/") || name.startsWith("@features/")) {
		return new URL(`${name.replace(/^@(lib|features)\//, "$1/")}.ts`, srcRoot);
	}
	return new URL(`${name}.ts`, referrer ? new URL(referrer.identifier) : sourceRoot);
}

// Exercise the production preview with a fake Actual bridge and real template filtering.
async function preview(rows) {
	const calls = [];
	const send = async (method, args) => {
		calls.push({ method, args });
		if (method === "get-cell") {
			assert.equal(args.sheetName, "budget202701");
			const row = rows.find((row) => args.name === `budget-${row.id}`);
			if (row.readFails) {
				throw new Error("Cell read failed");
			}
			return { value: row.assigned };
		}
		assert.equal(method, "budget/dry-run-category-template");
		assert.equal(args.month, "2027-01");
		assert.ok(args.templates.every((template) => template.type !== "remainder"));
		return { budgeted: rows.find((row) => row.id === args.categoryId).target };
	};
	const templates = new Map(
		rows.map((row) => [
			row.id,
			(row.kinds ?? ["simple"]).map((kind) => ({ kind, engineTemplate: { type: kind } })),
		]),
	);
	const mocks = {
		"@lib/actual/actual-api": { send },
		"./actual-data": {
			loadTemplatesByCategoryId: async (fresh) => {
				assert.equal(fresh, true);
				return templates;
			},
		},
	};
	async function load(name, referrer) {
		if (mocks[name]) {
			return new SyntheticModule(Object.keys(mocks[name]), function () {
				for (const [key, value] of Object.entries(mocks[name])) {
					this.setExport(key, value);
				}
			});
		}
		const url = resolve(name, referrer);
		const source = await readFile(url, "utf8");
		const module = new SourceTextModule(stripTypeScriptTypes(source), { identifier: url.href });
		await module.link(load);
		return module;
	}
	const module = await load("./next-month-coverage");
	await module.evaluate();
	return { total: await module.namespace.previewMonthTemplateTotal("2027-01", rows), calls };
}

for (const [name, assigned, expected] of [
	["unfunded", 0, 10000],
	["partially funded", 4000, 6000],
	["fully funded", 10000, 0],
	["overfunded", 15000, 0],
	["negative assignment", -2000, 12000],
	["empty assignment cell", "", 10000],
]) {
	test(`${name} goal reports remaining funding`, async () => {
		const { total } = await preview([{ id: "rent", target: 10000, assigned }]);
		assert.equal(total, expected);
	});
}

test("excess in one goal does not hide another goal's shortfall", async () => {
	const { total } = await preview([
		{ id: "rent", target: 10000, assigned: 20000 },
		{ id: "food", target: 8000, assigned: 3000 },
		{ id: "unrelated", kinds: [], assigned: 50000 },
	]);
	assert.equal(total, 5000);
});

test("remainder-only and untemplated categories do not contribute", async () => {
	const { total, calls } = await preview([
		{ id: "remainder", kinds: ["remainder"], assigned: 5000 },
		{ id: "none", kinds: [], assigned: 9000 },
		{ id: "mixed", kinds: ["simple", "remainder"], target: 10000, assigned: 2500 },
	]);
	assert.equal(total, 7500);
	assert.equal(calls.length, 2);
});

for (const invalid of [
	{ readFails: true },
	{ assigned: undefined },
	{ assigned: NaN },
	{ target: NaN },
]) {
	test(`unavailable data returns no partial target: ${Object.keys(invalid)}`, async () => {
		const { total } = await preview([
			{ id: "valid", target: 10000, assigned: 4000 },
			{ id: "invalid", target: 10000, assigned: 0, ...invalid },
		]);
		assert.equal(total, null);
	});
}
