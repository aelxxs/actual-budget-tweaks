import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const source = await readFile(new URL("../src/features/settings-sync.ts", import.meta.url), "utf8");

async function setup(initial, budgets, userId = null) {
	const stored = new Map(Object.entries(initial));
	const saves = [];
	const applied = [];
	const listeners = new Map();
	let current = "a";
	let loaded = true;
	let watcher;
	let onSet;
	const context = createContext({
		console,
		setTimeout,
		document: {
			querySelector: () => (loaded ? {} : null),
			addEventListener() {},
			removeEventListener() {},
		},
		window: {
			addEventListener: (event, fn) => listeners.set(event, fn),
			removeEventListener: (event) => listeners.delete(event),
		},
	});
	const exports = {
		BUDGET_LINK: "budget-link",
		loadCurrentBudgetId: async () => current,
		notify: async () => {},
		send: async (method, args) => {
			if (method === "subscribe-get-user") {
				return { userId };
			}
			if (method === "preferences/get") {
				return budgets[current];
			}
			if (method === "preferences/save") {
				saves.push({ budget: current, ...args });
			}
		},
		watchDom: (fn) => {
			watcher = fn;
			return () => {};
		},
		createLogger: () => ({ info() {}, error() {} }),
		getValue: async (key, fallback) => stored.get(key) ?? fallback,
		hasValue: async (key) => stored.has(key),
		onSetValue: (fn) => (onSet = fn),
		setValue: async (key, value) => {
			onSet?.(key, value);
			stored.set(key, value);
		},
		removeValue: async (key) => stored.delete(key),
		reapplySetting: async (setting, value) => applied.push([setting.context.key, value]),
	};
	const module = new SourceTextModule(stripTypeScriptTypes(source), { context });
	await module.link(
		() =>
			new SyntheticModule(
				Object.keys(exports),
				function () {
					for (const [key, value] of Object.entries(exports)) {
						this.setExport(key, value);
					}
				},
				{ context },
			),
	);
	await module.evaluate();
	const settings = [
		{ type: "checkbox", context: { key: "graph-view", defaultValue: false } },
		{ type: "checkbox", context: { key: "calendar", defaultValue: false } },
		{ type: "select", context: { key: "density", defaultValue: "normal" } },
		{ type: "custom", context: { key: "custom", defaultValue: "default" } },
		// Like the theme: other keys it reads come along through `syncs`.
		{
			type: "custom",
			context: { key: "theme", defaultValue: "dark" },
			apply() {},
			syncs: ["user-themes"],
		},
	];
	const stop = module.namespace.startSettingsSync(settings);
	const settle = () => new Promise(setImmediate);
	await settle();
	return {
		stored,
		saves,
		applied,
		stop,
		async switchTo(id) {
			loaded = false;
			watcher();
			current = id;
			loaded = true;
			watcher();
			await settle();
		},
	};
}

test("a budget without preferences starts from defaults without importing browser data", async () => {
	const fixture = await setup(
		{
			"graph-view": true,
			calendar: true,
			density: "compact",
			custom: "other budget",
			"category-colors": { "other-category": "red" },
			"abt-account-icons": { "other-account": "private icon" },
			"user-themes": [{ name: "other budget theme" }],
		},
		{ a: {} },
	);
	assert.equal(fixture.stored.get("graph-view"), false);
	assert.equal(fixture.stored.get("calendar"), false);
	assert.equal(fixture.stored.get("density"), "normal");
	assert.equal(fixture.stored.get("custom"), "default");
	for (const key of ["category-colors", "abt-account-icons", "user-themes"]) {
		assert.equal(fixture.stored.has(key), false);
	}
	assert.ok(fixture.applied.some(([key, value]) => key === "graph-view" && value === false));
	assert.equal(
		fixture.saves.some(({ id }) => id === "abt:graph-view"),
		false,
	);
	assert.equal(
		fixture.saves.some(({ id }) => id === "abt:category-colors"),
		false,
	);
	fixture.stop();
});

test("switching budgets resets missing settings and restores saved values on return", async () => {
	const fixture = await setup(
		{},
		{
			a: { "abt:graph-view": "true", "abt:category-colors": '{"a":"red"}' },
			b: { "abt:calendar": "true" },
		},
	);
	assert.equal(fixture.stored.get("graph-view"), true);
	await fixture.switchTo("b");
	assert.equal(fixture.stored.get("graph-view"), false);
	assert.equal(fixture.stored.get("calendar"), true);
	assert.equal(fixture.stored.has("category-colors"), false);
	await fixture.switchTo("a");
	assert.equal(fixture.stored.get("graph-view"), true);
	assert.equal(fixture.stored.get("calendar"), false);
	assert.equal(fixture.stored.get("category-colors").a, "red");
	fixture.stop();
});

test("cleared and malformed preferences cannot retain values from another budget", async () => {
	const fixture = await setup(
		{ "graph-view": true, calendar: true },
		{ a: { "abt:graph-view": null, "abt:calendar": "invalid JSON" } },
	);
	assert.equal(fixture.stored.get("graph-view"), false);
	assert.equal(fixture.stored.get("calendar"), false);
	fixture.stop();
});

test("a new user's missing preferences use defaults rather than this browser's cache", async () => {
	const fixture = await setup({ "graph-view": true }, { a: {} }, "new-user");
	assert.equal(fixture.stored.get("graph-view"), false);
	assert.equal(
		fixture.saves.some(({ id }) => id === "abt:new-user:graph-view"),
		false,
	);
	fixture.stop();
});

test("a synced key a custom setting reads reapplies that setting instead of asking for a reload", async () => {
	const fixture = await setup(
		{ theme: "light" },
		{ a: { "abt:theme": '"light"', "abt:user-themes": '{"user:1":{"name":"Mine"}}' } },
	);
	assert.equal(JSON.stringify(fixture.stored.get("user-themes")), '{"user:1":{"name":"Mine"}}');
	assert.ok(fixture.applied.some(([key, value]) => key === "theme" && value === "light"));
});
