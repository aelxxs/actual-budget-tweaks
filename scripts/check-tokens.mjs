// Flags hand-written values that have a token in src/lib/styles/ui.css, so the scales don't
// drift apart again, and Actual's hashed class names, which change with every Actual release.
// Selectors for Actual's DOM (test ids, roles, its links, cell names) live in
// src/lib/actual-dom.ts, which the smoke test checks against Actual.
// A deliberate exception carries a `raw:` comment on the same line,
// e.g. `border-radius: 11px; /* raw: fixed to match the shortcut tiles */`.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = ["src", "public/css"];
const SKIP = [
	"src/lib/styles/ui.css", // defines the tokens
	"src/entrypoints/popup/", // its own page; doesn't load ui.css
	"public/css/base.css", // overrides Actual's own styles
];
const EXT = /\.(svelte|css|ts)$/;

const HASHED = {
	// Emotion hashes always contain a digit, which keeps BEM names like `creator__css-input` out.
	re: /(?<![\w-])css-(?=[a-z]*\d)[a-z0-9]{5,8}\b/g,
	hint: "anchor on a data-testid, role, structure or a native-hooks data-abt-* marker",
};

const REGISTRY = "src/lib/actual-dom.ts";
const TEST_ID = {
	re: /\[data-testid[\^*$]?=|\[role=|\[data-(?:cellname|focus-key)\b|a\[href[\^*$]?=["']\/\w/g,
	hint: `import the selector from ${REGISTRY}, adding it there if it's new`,
};

const RULES = [
	{
		re: /color-mix\(\s*in srgb,\s*var\(--color-pageText\)\s+[\d.]+%,\s*transparent\s*\)/g,
		hint: "use an ink step (--abt-ink-1..5) or --abt-subtle/soft/muted",
	},
	{
		re: /color-mix\(\s*in srgb,\s*var\(--abt-accent\)\s+[\d.]+%,\s*transparent\s*\)/g,
		hint: "use an accent step (--abt-accent-1..4)",
	},
	{
		re: /font-size:\s*(?:9|1[0-6])(?:\.\d+)?px/g,
		hint: "use --abt-text-* (9-16px); display sizes of 17px+ may stay raw",
	},
	{
		re: /border-radius:\s*(?:[4-9]|1[0-4])(?:\.\d+)?px\s*(?:!important\s*)?[;}"]/g,
		hint: "use --abt-radius-sm / --abt-radius / --abt-radius-lg",
	},
	{
		re: /border-radius:\s*(?:50%|999px)/g,
		hint: "use --abt-radius-pill",
	},
	{
		re: /color-mix\(\s*in srgb,\s*var\(--color-(?:budgetNumberPositive|warningText|errorText)\)\s+[\d.]+%,\s*transparent\s*\)/g,
		hint: "use a status step (--abt-positive-1..4, --abt-warning-1..4, --abt-danger-1..4)",
	},
	{
		re: /box-shadow:\s*0 \d+px \d+px rgba?\(/g,
		hint: "use --abt-shadow-sm / --abt-shadow / --abt-shadow-lg",
	},
	{
		// Every px value on the spacing scale: the whole declaration has a token form.
		re: /^\s*(?:gap|row-gap|column-gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|inset(?:-[a-z]+)?):(?:\s+(?:0|auto|var\([^)]*\)))*\s+(?:2|4|8|12|16|24)px(?:\s+(?:(?:2|4|8|12|16|24)px|0|auto|var\([^)]*\)))*\s*(?:!important\s*)?;/g,
		hint: "use --abt-space-1..6 (2, 4, 8, 12, 16, 24px)",
	},
];

// ABT's own components use --abt-muted (or --abt-soft/--abt-subtle); pageTextSubdued is for
// matching Actual's own text, in adapter CSS.
const SUBDUED = {
	re: /var\(--color-pageTextSubdued\)/g,
	hint: "use --abt-muted in ABT's own UI; pageTextSubdued only where matching Actual's text",
};

function* walk(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(path);
		} else if (EXT.test(entry.name)) {
			yield path;
		}
	}
}

const problems = [];
for (const base of SCAN) {
	for (const file of walk(join(root, base))) {
		const rel = relative(root, file);
		const rules = SKIP.some((s) => rel.startsWith(s)) ? [HASHED] : [HASHED, ...RULES];
		if (rel.startsWith("src/") && rel !== REGISTRY) {
			rules.push(TEST_ID);
		}
		if (rel.endsWith(".svelte")) {
			rules.push(SUBDUED);
		}
		readFileSync(file, "utf8")
			.split("\n")
			.forEach((line, i) => {
				if (line.includes("raw:") || /^\s*(\/\/|\*|\/\*)/.test(line)) {
					return;
				}
				for (const { re, hint } of rules) {
					for (const m of line.matchAll(re)) {
						problems.push(`${rel}:${i + 1}  ${m[0].replace(/[;}"]$/, "")}  → ${hint}`);
					}
				}
			});
	}
}

// base.css can't import the registry, so each test id it uses must be listed there.
const registry = readFileSync(join(root, REGISTRY), "utf8");
readFileSync(join(root, "public/css/base.css"), "utf8")
	.split("\n")
	.forEach((line, i) => {
		for (const m of line.matchAll(/\[data-testid([\^*$]?)="([^"]+)"\]/g)) {
			if (!registry.includes(m[1] ? m[0] : `byTestId("${m[2]}")`)) {
				problems.push(`public/css/base.css:${i + 1}  ${m[0]}  → add it to ${REGISTRY}`);
			}
		}
	});

if (problems.length) {
	console.error(problems.join("\n"));
	console.error(`\n${problems.length} problem(s). Mark deliberate ones with a "raw:" comment.`);
	process.exit(1);
}
console.log("Tokens check passed.");
