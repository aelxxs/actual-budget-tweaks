import { injectMainWorldScript } from "@lib/utilities/inject-main-world";
import { isAbtEnabled } from "@lib/utilities/abt-enabled";
import { getBaseUrl } from "@lib/utilities/store";

export default defineContentScript({
	matches: ["<all_urls>"],
	async main() {
		const baseUrl = await getBaseUrl();
		if (baseUrl && window.location.href.startsWith(baseUrl) && (await isAbtEnabled())) {
			await injectMainWorldScript("/actual-api-bridge-main.js");
		}
	},
});
