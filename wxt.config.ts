import { resolve } from "path";
import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	outDir: resolve(__dirname, ".output"),
	modules: ["@wxt-dev/module-svelte"],
	manifest: {
		name: "Actual Budget – Tweaks",
		description: "",
		permissions: ["storage", "tabs"],
		browser_specific_settings: {
			gecko: {
				data_collection_permissions: {
					required: ["none"],
				},
			},
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
					"content-scripts/content.css",
					"content-scripts/income-breakdown.css",
					"content-scripts/template-apply-breakdown.css",
					"lib/d3.min.js",
					"lib/d3-sankey.min.js",
					"content-scripts/income-breakdown.js",
					"content-scripts/category-template-insights.js",
					"content-scripts/schedule-highlight.js",
					"content-scripts/template-apply-breakdown.js",
				],
				matches: ["<all_urls>"],
			},
		],
	},
});
