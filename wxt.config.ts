import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/module-svelte"],
	manifest: {
		name: "Actual Budget – Tweaks",
		description: "",
		permissions: ["storage"],
		browser_specific_settings: {
			gecko: {
				data_collection_permissions: {
					required: ["none"],
				},
			},
		},
		web_accessible_resources: [
			{
				resources: ["css/base.css"],
				matches: ["<all_urls>"],
			},
		],
	},
});
