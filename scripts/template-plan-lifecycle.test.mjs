import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const sourceUrl = new URL("../src/features/workflows/template-plan/index.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const ast = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);

async function setup({ deferRestore = false } = {}) {
	const nodes = new Set();
	const listeners = new Map();
	const watchers = new Set();
	const intervals = new Set();
	const restores = [];
	let panelOpen = false;
	let mounted = 0;
	const state = { activeTab: "breakdown", prioCollapseOverrides: {} };
	const node = () => ({
		style: {},
		setAttribute() {},
		appendChild() {},
		addEventListener() {},
		remove() {
			nodes.delete(this);
		},
	});
	const context = createContext({
		console,
		document: {
			getElementById: (id) => [...nodes].find((node) => node.id === id),
			createElement: node,
			createTextNode: (text) => text,
			body: { appendChild: (node) => nodes.add(node) },
			addEventListener: (event, handler) => listeners.set(event, handler),
			removeEventListener: (event, handler) => {
				assert.equal(listeners.get(event), handler);
				listeners.delete(event);
			},
		},
		setInterval: (fn) => {
			intervals.add(fn);
			return fn;
		},
		clearInterval: (fn) => intervals.delete(fn),
	});
	const overrides = {
		defineSetting: (setting) => setting,
		templatePlanState: state,
		getValue: async (_key, fallback) => fallback,
		Page: { Budget: "budget" },
		matchesPage: () => true,
		isBudgetPage: () => true,
		createPriorityPlanner: () => ({}),
		watchDom: (fn) => {
			watchers.add(fn);
			fn();
			return () => watchers.delete(fn);
		},
		wasPanelPersistedOpen: () =>
			deferRestore ? new Promise((resolve) => restores.push(resolve)) : Promise.resolve(true),
		sidepanel: {
			open: () => (panelOpen = true),
			close: () => (panelOpen = false),
			dismiss: () => (panelOpen = false),
			isOpen: () => panelOpen,
		},
		mountToNodeWithReturn: () => {
			mounted++;
			const body = node();
			nodes.add(body);
			return { node: body, instance: {} };
		},
		unmount: () => mounted--,
	};
	const imports = new Map();
	for (const statement of ast.statements) {
		if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
		const names = [];
		if (statement.importClause?.name) names.push("default");
		for (const entry of statement.importClause?.namedBindings?.elements ?? []) {
			if (!entry.isTypeOnly) names.push(entry.propertyName?.text ?? entry.name.text);
		}
		imports.set(statement.moduleSpecifier.text, names);
	}
	const module = new SourceTextModule(stripTypeScriptTypes(source), { context });
	await module.link(
		(name) =>
			new SyntheticModule(
				imports.get(name),
				function () {
					for (const key of imports.get(name)) this.setExport(key, overrides[key] ?? (() => {}));
				},
				{ context },
			),
	);
	await module.evaluate();
	return {
		setting: module.namespace.templatePlan,
		restores,
		assertClean() {
			assert.equal(nodes.size, 0, "injected nodes removed");
			assert.equal(listeners.size, 0, "document listeners removed");
			assert.equal(watchers.size, 0, "DOM watcher unsubscribed");
			assert.equal(intervals.size, 0, "polling stopped");
			assert.equal(mounted, 0, "Svelte panel unmounted");
			assert.equal(panelOpen, false, "drawer closed");
			assert.equal(state.onTabChange, null);
			assert.equal(state.applyTemplates, null);
		},
		assertOpen() {
			assert.equal(panelOpen, true);
			assert.equal(mounted, 1);
		},
		assertClosed() {
			assert.equal(panelOpen, false);
			assert.equal(mounted, 0);
		},
	};
}

test("disabling Template Plan removes the open panel and all feature subscriptions", async () => {
	const fixture = await setup();
	for (let cycle = 0; cycle < 2; cycle++) {
		const cleanup = await fixture.setting.init();
		fixture.assertOpen();
		await cleanup();
		fixture.assertClean();
	}
});

test("pending panel restores cannot recreate UI after disabling", async () => {
	const fixture = await setup({ deferRestore: true });
	const cleanup = await fixture.setting.init();
	await cleanup();
	fixture.restores.forEach((resolve, index) => resolve(index % 2 === 0));
	await Promise.resolve();
	fixture.assertClean();
});

test("a previous activation cannot restore a panel after re-enabling", async () => {
	const fixture = await setup({ deferRestore: true });
	const firstCleanup = await fixture.setting.init();
	await firstCleanup();
	const staleRestores = fixture.restores.splice(0);
	const cleanup = await fixture.setting.init();
	staleRestores.forEach((resolve) => resolve(true));
	await Promise.resolve();
	fixture.assertClosed();
	await cleanup();
	fixture.assertClean();
});

test("both settings declare literal label, description, icon and group metadata", async () => {
	for (const file of ["index.ts", "coverage-method.ts"]) {
		const text = await readFile(new URL(file, sourceUrl), "utf8");
		const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		let checked = 0;
		function visit(node) {
			if (ts.isCallExpression(node) && node.expression.getText(tree) === "defineSetting") {
				for (const field of ["label", "description", "icon", "group"]) {
					const property = node.arguments[0].properties.find(
						(p) => p.name?.getText(tree) === field,
					);
					assert.ok(property && ts.isStringLiteral(property.initializer), `${file}: ${field}`);
				}
				checked++;
			}
			ts.forEachChild(node, visit);
		}
		visit(tree);
		assert.equal(checked, 1);
	}
});
