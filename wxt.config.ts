import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/module-svelte"],
	manifest: {
		permissions: ["storage"],
	},
});
