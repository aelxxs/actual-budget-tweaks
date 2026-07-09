import { query } from "@lib/utilities/actual-api";

const PRIVACY_CLASS = "abt-privacy-enabled";
const BALANCE_SELECTOR = '[data-testid="sidebar-all-accounts-balance"]';

let privacyModeEnabled = false;

function setPrivacyModeClass(enabled: boolean): void {
	document.body.classList.toggle(PRIVACY_CLASS, enabled);
}

async function refreshPrivacyMode(): Promise<boolean> {
	try {
		const rows = await query<{ id: string; value: string }[]>("preferences", {
			filter: { id: "isPrivacyEnabled" },
		});
		privacyModeEnabled = String(rows?.[0]?.value) === "true";
		setPrivacyModeClass(privacyModeEnabled);
	} catch (err) {
		console.warn("[ABT] Failed to read privacy mode:", err);
	}
	return privacyModeEnabled;
}

export function getPrivacyMode(): boolean {
	return privacyModeEnabled;
}

// The sidebar's all-accounts balance node re-renders whenever the user
// toggles privacy mode elsewhere in the app, so watching it for mutations
// lets us pick up the change without polling the preferences table.
function observeSidebarBalance(callback: () => void): void {
	let attached = false;
	function tryAttach() {
		if (attached) return;
		const target = document.querySelector(BALANCE_SELECTOR);
		if (!target) {
			setTimeout(tryAttach, 200);
			return;
		}
		const observer = new MutationObserver(callback);
		observer.observe(target, { childList: true, subtree: true, characterData: true });
		attached = true;
	}
	tryAttach();
}

export const privacyMode = {
	type: "core" as const,
	init: () => {
		refreshPrivacyMode();
		observeSidebarBalance(refreshPrivacyMode);
	},
};
