// Flags hand-written values that have a token in src/lib/styles/ui.css, so the scales don't
// drift apart again. A deliberate exception carries a `raw:` comment on the same line,
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
];

function* walk(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else if (EXT.test(entry.name)) yield path;
	}
}

const problems = [];
for (const base of SCAN) {
	for (const file of walk(join(root, base))) {
		const rel = relative(root, file);
		if (SKIP.some((s) => rel.startsWith(s))) continue;
		readFileSync(file, "utf8")
			.split("\n")
			.forEach((line, i) => {
				if (line.includes("raw:")) return;
				for (const { re, hint } of RULES) {
					for (const m of line.matchAll(re)) {
						problems.push(`${rel}:${i + 1}  ${m[0].replace(/[;}"]$/, "")}  → ${hint}`);
					}
				}
			});
	}
}

if (problems.length) {
	console.error(problems.join("\n"));
	console.error(
		`\n${problems.length} raw value(s) with a token. Mark deliberate ones with a "raw:" comment.`,
	);
	process.exit(1);
}
console.log("Tokens check passed.");
