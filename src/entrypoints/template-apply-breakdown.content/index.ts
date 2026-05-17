import { injectMainWorldScript } from "@/lib/utilities/inject-main-world";
import { getBaseUrl } from "@/lib/utilities/store";

export default defineContentScript({
	matches: ["<all_urls>"],
	async main() {
		const baseUrl = await getBaseUrl();
		if (!baseUrl || !window.location.href.startsWith(baseUrl)) return;

		const cssId = "abt-template-apply-breakdown-css";
		if (!document.getElementById(cssId)) {
			const link = document.createElement("link");
			link.id = cssId;
			link.rel = "stylesheet";
			link.href = browser.runtime.getURL("/css/template-apply-breakdown.css");
			document.documentElement.appendChild(link);
		}

		await injectMainWorldScript("/template-apply-breakdown-main.js", "abt-template-apply-breakdown-main");
	},
});
