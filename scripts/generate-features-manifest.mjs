// Statically extracts the settings catalog (scriptSections) from
// src/features/index.ts into a JSON manifest the website can render as a
// features page, without hardcoding a second copy of the list.
//
// This walks the TypeScript AST instead of importing the real modules,
// because several setting files pull in Svelte components / browser APIs
// that can't be safely evaluated in a plain Node script.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const featuresDir = resolve(root, "src/features");
const entryFile = resolve(featuresDir, "index.ts");
const outFile = resolve(root, "website/src/data/features.json");

function parse(filePath) {
	const text = readFileSync(filePath, "utf8");
	return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function resolveImport(fromDir, importPath) {
	const base = resolve(fromDir, importPath);
	for (const candidate of [`${base}.ts`, join(base, "index.ts")]) {
		if (existsSync(candidate)) return candidate;
	}
	throw new Error(`Could not resolve import "${importPath}" from ${fromDir}`);
}

function stringLiteralValue(node) {
	if (!node) return undefined;
	if (ts.isStringLiteralLike(node)) return node.text;
	return undefined;
}

function findProperty(objectLiteral, name) {
	const prop = objectLiteral.properties.find(
		(p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name,
	);
	return prop?.initializer;
}

/** Finds `export const <name> = defineSetting({...})` (or a plain object literal) and pulls out label/description/icon/group. */
function extractSettingMeta(filePath, name) {
	const source = parse(filePath);
	let found;

	source.forEachChild((node) => {
		if (found) return;
		if (!ts.isVariableStatement(node)) return;
		for (const decl of node.declarationList.declarations) {
			if (!ts.isIdentifier(decl.name) || decl.name.text !== name || !decl.initializer) continue;
			let objectLiteral = decl.initializer;
			if (ts.isCallExpression(objectLiteral) && objectLiteral.arguments.length > 0) {
				objectLiteral = objectLiteral.arguments[0];
			}
			if (ts.isObjectLiteralExpression(objectLiteral)) found = objectLiteral;
		}
	});

	if (!found) return null;

	return {
		label: stringLiteralValue(findProperty(found, "label")) ?? "",
		description: stringLiteralValue(findProperty(found, "description")) ?? null,
		icon: stringLiteralValue(findProperty(found, "icon")) ?? null,
		group: stringLiteralValue(findProperty(found, "group")) ?? null,
	};
}

function buildImportMap(source, fileDir) {
	const map = new Map();
	source.forEachChild((node) => {
		if (!ts.isImportDeclaration(node)) return;
		if (!node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings)) return;
		if (!ts.isStringLiteral(node.moduleSpecifier)) return;
		const importPath = node.moduleSpecifier.text;
		if (!importPath.startsWith(".")) return; // skip type-only/aliased imports like "./types"

		let resolved;
		try {
			resolved = resolveImport(fileDir, importPath);
		} catch {
			return;
		}
		for (const el of node.importClause.namedBindings.elements) {
			map.set(el.name.text, resolved);
		}
	});
	return map;
}

function main() {
	const entrySource = parse(entryFile);
	const importMap = buildImportMap(entrySource, featuresDir);

	// `items:` in scriptSections is sometimes an inline array literal (e.g. `[themeSelector]`)
	// and sometimes a reference to a top-level const array (e.g. `items: layoutAndDensity`).
	// Collect every top-level `const name = [...]` so both forms resolve.
	const topLevelArrays = new Map();
	let scriptSectionsNode;
	entrySource.forEachChild((node) => {
		if (!ts.isVariableStatement(node)) return;
		for (const decl of node.declarationList.declarations) {
			if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
			if (decl.name.text === "scriptSections") {
				scriptSectionsNode = decl.initializer;
			} else if (ts.isArrayLiteralExpression(decl.initializer)) {
				topLevelArrays.set(decl.name.text, decl.initializer);
			}
		}
	});

	if (!scriptSectionsNode || !ts.isArrayLiteralExpression(scriptSectionsNode)) {
		throw new Error("Could not find `scriptSections` array in src/features/index.ts");
	}

	function resolveItemsArray(itemsNode) {
		if (!itemsNode) return null;
		if (ts.isArrayLiteralExpression(itemsNode)) return itemsNode;
		if (ts.isIdentifier(itemsNode)) return topLevelArrays.get(itemsNode.text) ?? null;
		return null;
	}

	const sections = scriptSectionsNode.elements
		.filter(ts.isObjectLiteralExpression)
		.map((sectionLiteral) => {
			const title = stringLiteralValue(findProperty(sectionLiteral, "title")) ?? "";
			const description = stringLiteralValue(findProperty(sectionLiteral, "description")) ?? null;
			const itemsArray = resolveItemsArray(findProperty(sectionLiteral, "items"));

			const items = [];
			if (itemsArray) {
				for (const el of itemsArray.elements) {
					if (!ts.isIdentifier(el)) continue;
					const filePath = importMap.get(el.text);
					if (!filePath) continue;
					const meta = extractSettingMeta(filePath, el.text);
					if (meta && meta.label) items.push(meta);
				}
			}

			return { title, description, items };
		})
		.filter((section) => section.items.length > 0);

	writeFileSync(outFile, `${JSON.stringify(sections, null, "\t")}\n`);
	console.log(`Wrote ${sections.reduce((n, s) => n + s.items.length, 0)} settings across ${sections.length} sections to ${outFile}`);
}

main();
