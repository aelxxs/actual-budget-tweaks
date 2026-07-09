import { fetchReleaseNotes } from "@lib/utilities/changelog";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";
import { mountToNode } from "@lib/utilities/svelte";
import ReleaseNotification from "./ReleaseNotification.svelte";

const PENDING_KEY = "release-notes-pending-version";
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
		if (optedOut) return;

		const version = await getValue<string | null>(PENDING_KEY, null);
		if (!version) return;

		const sections = await fetchReleaseNotes(version);

		const wrap = mountToNode(ReleaseNotification, {
			version,
			sections,
			releaseUrl: `${RELEASES_BASE_URL}/v${version}`,
			onClose: async (dontShowAgain: boolean) => {
				await setValue(PENDING_KEY, null);
				if (dontShowAgain) await setValue(OPT_OUT_KEY, true);
				wrap.remove();
			},
		});
		wrap.className = WRAP_CLASS;
		document.body.appendChild(wrap);
	},
};
