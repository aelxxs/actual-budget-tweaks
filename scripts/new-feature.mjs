// Scaffolds a new feature: creates the setting file (and, with --component,
// a companion Svelte component) and registers it in src/features/index.ts.
//
// Registration uses the TypeScript compiler API to locate the exact
// insertion points (same approach as generate-features-manifest.mjs), then
// splices text at those offsets rather than reprinting the whole AST, so the
// rest of the file is untouched. Run `pnpm format` afterward to clean up.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const featuresDir = resolve(root, "src/features");
const entryFile = resolve(featuresDir, "index.ts");

// Maps the CLI "category" argument to its folder under src/features/ and the settings-page
// section (a `title` in scriptSections, src/features/index.ts) it's listed in unless --section
// says otherwise. New desktop features start in Experimental until they find their place.
const CATEGORIES = {
	layout: { dir: "layout", section: "Experimental" },
	readability: { dir: "readability", section: "Experimental" },
	appearance: { dir: "appearance", section: "Experimental" },
	workflows: { dir: "workflows", section: "Experimental" },
	mobile: { dir: "mobile", section: "Mobile" },
};

function usageAndExit(message) {
	if (message) {
		console.error(`Error: ${message}\n`);
	}
	console.error(
		[
			'Usage: pnpm new-feature <category> <kebab-name> "<Label>" <type> [--section "<Title>"] [--component]',
			"",
			`  category    one of: ${Object.keys(CATEGORIES).join(", ")}`,
			"  kebab-name  e.g. budget-warnings — becomes the file name and storage key",
			"  Label       display label shown in the settings panel",
			"  type        checkbox | select | custom",
			"  --section   the settings-page section to list it under (default: Mobile for mobile, else Experimental)",
			"  --component generate a folder with a companion .svelte file, instead of one flat .ts file",
			"",
			'Example: pnpm new-feature readability budget-warnings "Budget Warnings" checkbox',
		].join("\n"),
	);
	process.exit(1);
}

const args = process.argv.slice(2);
const withComponent = args.includes("--component");
const sectionAt = args.indexOf("--section");
const sectionArg = sectionAt === -1 ? undefined : args[sectionAt + 1];
const [category, kebabName, label, type] = args.filter(
	(a, i) => a !== "--component" && (sectionAt === -1 || (i !== sectionAt && i !== sectionAt + 1)),
);

if (!category || !kebabName || !label || !type) {
	usageAndExit("missing arguments");
}
if (!CATEGORIES[category]) {
	usageAndExit(`category must be one of: ${Object.keys(CATEGORIES).join(", ")}`);
}
if (!["checkbox", "select", "custom"].includes(type)) {
	usageAndExit("type must be checkbox, select, or custom");
}
if (!/^[a-z][a-z0-9-]*$/.test(kebabName)) {
	usageAndExit("kebab-name must be lowercase and hyphen-separated, e.g. budget-warnings");
}

function toCamelCase(kebab) {
	return kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}
function toPascalCase(kebab) {
	const camel = toCamelCase(kebab);
	return camel[0].toUpperCase() + camel.slice(1);
}

const { dir } = CATEGORIES[category];
const section = sectionArg ?? CATEGORIES[category].section;
const isMobile = dir === "mobile";
const groupLine = isMobile
	? `\tgroup: "Mobile",\n\tplatform: "mobile",\n`
	: `\tgroup: "General",\n`;
const camelName = toCamelCase(kebabName);
const pascalName = toPascalCase(kebabName);
const importPath = `./${dir}/${kebabName}`;
const featureDir = resolve(featuresDir, dir);
const targetPath = withComponent
	? resolve(featureDir, kebabName, "index.ts")
	: resolve(featureDir, `${kebabName}.ts`);

if (existsSync(targetPath)) {
	usageAndExit(`${targetPath.replace(root + "/", "")} already exists`);
}

async function loadTypeScript() {
	const candidates = [
		"typescript",
		resolve(__dirname, "../node_modules/typescript/lib/typescript.js"),
	];
	for (const candidate of candidates) {
		try {
			const resolved = typeof candidate === "string" ? candidate : pathToFileURL(candidate).href;
			const module = await import(resolved);
			return module.default ?? module;
		} catch {
			// Keep trying the next candidate.
		}
	}
	throw new Error("Could not load TypeScript from the workspace.");
}

function settingFileContent() {
	const componentImport = withComponent
		? `import ${pascalName} from "./${pascalName}.svelte";\n`
		: "";

	if (type === "custom") {
		return `${componentImport}import { defineSetting } from "@features/types";

export const ${camelName} = defineSetting({
	type: "custom",
	label: "${label}",
	description: "",
${groupLine}${withComponent ? `\tcomponent: ${pascalName},\n` : ""}\tcontext: {
		key: "${kebabName}",
		defaultValue: null,
	},
	// Unlike checkbox/select, a custom setting's init has no cleanup return —
	// manage its lifecycle (e.g. mount/unmount) inside the component itself.
	init: (ctx) => {
		// mount/init your component or DOM work here
	},
});
`;
	}

	const contextDefault = type === "checkbox" ? "false" : '""';
	const optionsField = type === "select" ? `\toptions: [{ value: "", label: "" }],\n` : "";

	return `${componentImport}import { defineSetting } from "@features/types";

export const ${camelName} = defineSetting({
	// TODO: pick a real icon from src/lib/icons.ts
	type: "${type}",
	label: "${label}",
	description: "",
${groupLine}	icon: "palette",
${optionsField}\tcontext: {
		key: "${kebabName}",
		defaultValue: ${contextDefault},
	},
	css: () => \`
		/* styles go here */
	\`,
	init: (ctx) => {
		// activate the feature here — see CONTRIBUTING.md for the page-gating
		// (matchesPage) and cleanup conventions this codebase uses
		return () => {
			// cleanup
		};
	},
});
`;
}

function componentFileContent() {
	return `<script lang="ts">
	import type { SettingContext } from "@features/types";

	const { ctx }: { ctx: SettingContext } = $props();
</script>

<div class="${kebabName}">
	<!-- component markup -->
</div>

<style>
	.${kebabName} {
		/* styles go here */
	}
</style>
`;
}

function registerInIndex(ts) {
	const text = readFileSync(entryFile, "utf8");
	const source = ts.createSourceFile(
		entryFile,
		text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	// The items array of the section's last group, in scriptSections.
	const titleOf = (obj) =>
		obj.properties.find(
			(p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "title",
		)?.initializer;
	const propOf = (obj, name) =>
		obj.properties.find(
			(p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name,
		)?.initializer;
	let sections;
	source.forEachChild((node) => {
		if (!ts.isVariableStatement(node)) {
			return;
		}
		for (const decl of node.declarationList.declarations) {
			if (
				ts.isIdentifier(decl.name) &&
				decl.name.text === "scriptSections" &&
				decl.initializer &&
				ts.isArrayLiteralExpression(decl.initializer)
			) {
				sections = decl.initializer.elements.filter(ts.isObjectLiteralExpression);
			}
		}
	});
	if (!sections) {
		throw new Error(
			'Could not find "export const scriptSections = [...]" in src/features/index.ts',
		);
	}
	const target = sections.find((s) => {
		const title = titleOf(s);
		return title && ts.isStringLiteral(title) && title.text === section;
	});
	if (!target) {
		const titles = sections.map((s) => titleOf(s)?.text).filter(Boolean);
		throw new Error(`No section titled "${section}"; one of: ${titles.join(", ")}`);
	}
	const groups = propOf(target, "groups");
	const lastGroup =
		groups && ts.isArrayLiteralExpression(groups)
			? groups.elements.filter(ts.isObjectLiteralExpression).at(-1)
			: undefined;
	const arrayNode = lastGroup && propOf(lastGroup, "items");
	if (!arrayNode || !ts.isArrayLiteralExpression(arrayNode)) {
		throw new Error(`Section "${section}" has no group items to add to`);
	}

	// Find where the new import line should go: right before the first
	// existing import whose module specifier sorts after ours, preserving
	// the file's existing alphabetical order. Falls back to right after the
	// last import if ours would sort last.
	let importInsertPos;
	let lastImportEnd;
	source.forEachChild((node) => {
		if (!ts.isImportDeclaration(node)) {
			return;
		}
		lastImportEnd = node.end;
		if (importInsertPos !== undefined) {
			return;
		}
		if (!ts.isStringLiteral(node.moduleSpecifier)) {
			return;
		}
		if (node.moduleSpecifier.text.localeCompare(importPath) > 0) {
			importInsertPos = node.getStart();
		}
	});

	const closeBracketPos = arrayNode.getEnd() - 1; // position of the array's `]`

	// Multi-line arrays in this file end with a trailing comma before `]`;
	// single-line ones (e.g. `const workflows = [a, b, c];`) don't, so a
	// bare new line would land as `c\t${camelName},` with no separator.
	let itemInsertion;
	if (arrayNode.elements.length === 0) {
		itemInsertion = camelName;
	} else if (arrayNode.elements.hasTrailingComma) {
		itemInsertion = `\t${camelName},\n`;
	} else {
		itemInsertion = `, ${camelName}`;
	}

	// Splice the later position (the array) first so the earlier import
	// offset, computed against the original text, stays valid.
	let updated = text.slice(0, closeBracketPos) + itemInsertion + text.slice(closeBracketPos);

	if (importInsertPos !== undefined) {
		const importLine = `import { ${camelName} } from "${importPath}";\n`;
		updated = updated.slice(0, importInsertPos) + importLine + updated.slice(importInsertPos);
	} else {
		const importLine = `\nimport { ${camelName} } from "${importPath}";`;
		updated = updated.slice(0, lastImportEnd) + importLine + updated.slice(lastImportEnd);
	}

	writeFileSync(entryFile, updated);
}

async function main() {
	const ts = await loadTypeScript();

	// First, so an unknown --section stops before any file is written.
	registerInIndex(ts);

	mkdirSync(dirname(targetPath), { recursive: true });
	writeFileSync(targetPath, settingFileContent());
	console.log(`Created ${targetPath.replace(root + "/", "")}`);

	if (withComponent) {
		const componentPath = resolve(dirname(targetPath), `${pascalName}.svelte`);
		writeFileSync(componentPath, componentFileContent());
		console.log(`Created ${componentPath.replace(root + "/", "")}`);
	}

	console.log(`Registered "${camelName}" in src/features/index.ts under "${section}"`);

	console.log(
		[
			"",
			"Next steps:",
			"  1. Fill in the description/icon and implement init/css.",
			"  2. Run `pnpm format && pnpm check && pnpm lint`.",
			"  3. See CONTRIBUTING.md for conventions (page-gating, cleanup, etc).",
		].join("\n"),
	);
}

main();
