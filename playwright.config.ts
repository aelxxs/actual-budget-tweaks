import { defineConfig, devices } from "@playwright/test";

// Runs against Actual with ABT injected by the sidecar (docker/server.ts); see .github/workflows/smoke.yml.
export default defineConfig({
	testDir: "tests/smoke",
	timeout: 90_000,
	expect: { timeout: 15_000 },
	// A retry would find the server already set up.
	retries: 0,
	workers: 1,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: process.env.SMOKE_URL ?? "http://localhost:3005",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
		},
	],
});
