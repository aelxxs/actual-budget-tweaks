import { injectMainWorldScript } from "@lib/actual/inject-main-world";
import { isAbtEnabled } from "@lib/abt-enabled";
import { getBaseUrl } from "@lib/store";

export default defineContentScript({
	matches: ["<all_urls>"],
	async main() {
		const baseUrl = await getBaseUrl();
		if (baseUrl && window.location.href.startsWith(baseUrl) && (await isAbtEnabled())) {
			await injectMainWorldScript("/actual-api-bridge-main.js");
		}
	},
});
