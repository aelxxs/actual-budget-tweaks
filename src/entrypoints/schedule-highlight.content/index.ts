import { injectMainWorldScript } from "@/lib/utilities/inject-main-world";
import { getBaseUrl } from "@/lib/utilities/store";

export default defineContentScript({
	matches: ["<all_urls>"],
	async main() {
		const baseUrl = await getBaseUrl();
		if (!baseUrl || !window.location.href.startsWith(baseUrl)) return;

		await injectMainWorldScript("/schedule-highlight-main.js", "abt-schedule-highlight-main");
	},
});
