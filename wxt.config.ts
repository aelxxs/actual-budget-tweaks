import { resolve } from "path";
import type { UserManifest } from "wxt";
import { defineConfig } from "wxt";

type GeckoSettings = NonNullable<NonNullable<UserManifest["browser_specific_settings"]>["gecko"]> & {
	data_collection_permissions?: {
		required: string[];
	};
};

const geckoSettings: GeckoSettings = {
	data_collection_permissions: {
		required: ["none"],
	},
};

export default defineConfig({
	srcDir: "src",
	outDir: resolve(__dirname, ".output"),
	modules: ["@wxt-dev/module-svelte"],
	manifest: {
		name: "Actual Budget – Tweaks",
		description: "",
		permissions: ["storage", "tabs"],
		browser_specific_settings: {
			gecko: geckoSettings,
		},
		content_scripts: [
			{
				matches: ["<all_urls>"],
				js: ["content-scripts/income-breakdown-loader.js"],
			},
			{
				matches: ["<all_urls>"],
				js: ["content-scripts/category-template-insights-loader.js"],
			},
			{
				matches: ["<all_urls>"],
				js: ["content-scripts/schedule-highlight-loader.js"],
			},
			{
				matches: ["<all_urls>"],
				js: ["content-scripts/template-apply-breakdown-loader.js"],
			},
		],
		web_accessible_resources: [
			{
				resources: [
					"css/base.css",
					"css/income-breakdown.css",
					"css/template-apply-breakdown.css",
					"content-scripts/content.css",
					"lib/d3.min.js",
					"lib/d3-sankey.min.js",
					"content-scripts/dashboard-widget-utils.js",
					"content-scripts/income-breakdown.js",
					"content-scripts/category-template-insights.js",
					"content-scripts/privacy-utils.js",
					"content-scripts/schedule-highlight.js",
					"content-scripts/template-apply-breakdown.js",
					"content-scripts/template-apply-breakdown/actual-data.js",
					"content-scripts/template-apply-breakdown/constants.js",
					"content-scripts/template-apply-breakdown/dom.js",
					"content-scripts/template-apply-breakdown/money.js",
					"content-scripts/template-apply-breakdown/priority-plan.js",
					"content-scripts/template-apply-breakdown/templates.js",
				],
				matches: ["<all_urls>"],
			},
		],
	},
});
