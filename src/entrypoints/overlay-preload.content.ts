import { holdPageOnLoad } from "@lib/actual/overlay-hold";

// Before Actual's first paint, which the main content script starts too late to catch: a reload
// with the calendar or graph open hides the page under it until it reopens. Every site, as the
// main script is, since Actual's address is the user's; elsewhere it reads one storage key and stops.
export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_start",
	main() {
		holdPageOnLoad();
	},
});
