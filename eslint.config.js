import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";

export default ts.config(
	{
		ignores: [
			".output/**",
			".wxt/**",
			"node_modules/**",
			"website/**",
			"sidebar-test/**",
			"public/**",
			"images/**",
			".playwright-mcp/**",
			"*.config.js",
		],
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.webextensions,
				chrome: "readonly",
			},
		},
	},
	{
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
				extraFileExtensions: [".svelte"],
			},
		},
	},
	{
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "off",
			"no-undef": "off",
			"svelte/require-each-key": "error",
			curly: ["error", "all"],
			// Flags throwaway Map/Set/Date locals; this codebase copies and reassigns state instead of mutating it.
			"svelte/prefer-svelte-reactivity": "off",
			// These comments suppress Svelte compiler/svelte-check a11y diagnostics
			// (`pnpm check`), a separate diagnostic surface this ESLint config doesn't
			// itself lint, so ESLint can't tell they're in use.
			"svelte/no-unused-svelte-ignore": "off",
		},
	},
	{
		files: ["src/lib/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@features/*", "**/features", "**/features/*"],
							message:
								"src/lib is shared code and can't depend on a feature; move this into the feature.",
						},
					],
				},
			],
		},
	},
	{
		files: ["src/entrypoints/actual-api-bridge-main.ts"],
		rules: {
			// Untyped interop with Actual's own internal window globals ($q, $query,
			// __actionsForMenu, ...) — @ts-nocheck is deliberate here, not debt.
			"@typescript-eslint/ban-ts-comment": "off",
		},
	},
);
