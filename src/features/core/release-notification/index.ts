import { fetchReleaseNotes } from "@lib/changelog";
import { applyGlobalCSS } from "@lib/dom/dom";
import { getValue, setValue } from "@lib/store";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import ReleaseNotification from "./ReleaseNotification.svelte";

const PENDING_KEY = "release-notes-pending-version";
const SEEN_KEY = "release-notes-seen-version";
const OPT_OUT_KEY = "release-notes-opted-out";
const WRAP_CLASS = "abt-release-toast-wrap";
const RELEASES_BASE_URL = "https://github.com/aelxxs/actual-budget-tweaks/releases/tag";

const CSS = `
	.${WRAP_CLASS} {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 100000;
	}
`;

export const releaseNotification = {
	type: "core" as const,
	init: async () => {
		applyGlobalCSS(CSS, "release-notification");

		const optedOut = await getValue(OPT_OUT_KEY, false);
		if (optedOut) {
			return;
		}

		// The sidecar has no background script to see updates, so the page compares versions too.
		const current = browser.runtime.getManifest().version;
		const seen = await getValue<string | null>(SEEN_KEY, null);
		if (seen !== current) {
			await setValue(SEEN_KEY, current);
			// Nightly edge builds (1.2.3-edge.sha) have no changelog section or release page.
			if (seen && !current.includes("-")) {
				await setValue(PENDING_KEY, current);
			}
		}

		const version = await getValue<string | null>(PENDING_KEY, null);
		if (!version) {
			return;
		}

		const sections = await fetchReleaseNotes(version);

		let toast: Mounted | null = null;
		toast = mountToNodeWithReturn(ReleaseNotification, {
			version,
			sections,
			releaseUrl: `${RELEASES_BASE_URL}/v${version}`,
			onClose: async (dontShowAgain: boolean) => {
				await setValue(PENDING_KEY, null);
				if (dontShowAgain) {
					await setValue(OPT_OUT_KEY, true);
				}
				toast?.destroy();
			},
		});
		toast.node.className = WRAP_CLASS;
		document.body.appendChild(toast.node);
	},
};
