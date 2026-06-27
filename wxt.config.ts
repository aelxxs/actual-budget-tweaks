import { resolve } from "path";
import type { UserManifest } from "wxt";
import { defineConfig } from "wxt";

type GeckoSettings = NonNullable<NonNullable<UserManifest["browser_specific_settings"]>["gecko"]> & {
	data_collection_permissions?: {
		required: string[];
	};
};

const geckoSettings: GeckoSettings = {
	id: "actual-budget-tweaks@aelxxs",
	data_collection_permissions: {
		required: ["none"],
	},
};

export default defineConfig({
	srcDir: "src",
	vite: () => ({
		resolve: {
			alias: {
				"@lib": resolve(__dirname, "src/lib"),
				"@features": resolve(__dirname, "src/features"),
			},
		},
	}),
	outDir: resolve(__dirname, ".output"),
	modules: ["@wxt-dev/module-svelte"],
	manifest: {
		name: "Actual Budget – Tweaks",
		description: "",
		permissions: ["storage", "tabs"],
		browser_specific_settings: {
			gecko: geckoSettings,
		},
		host_permissions: [
			"https://raw.githubusercontent.com/*",
			"https://query2.finance.yahoo.com/*",
			"https://api.exchangerate-api.com/*",
		],
		web_accessible_resources: [
			{
				resources: [
					"income-breakdown-main.js",
					"schedule-highlight-main.js",
					"template-insights-main.js",
					"template-apply-breakdown-main.js",
					"actual-api-bridge-main.js",
					"css/base.css",
					"css/income-breakdown.css",
					"css/template-apply-breakdown.css",
					"content-scripts/content.css",
				],
				matches: ["<all_urls>"],
			},
		],
	},
});
