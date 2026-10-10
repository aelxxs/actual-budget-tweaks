import { query } from "@lib/utilities/actual-api";
import { watchDom, watchElement } from "@lib/utilities/dom-watcher";

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

// The sidebar's all-accounts balance re-renders whenever privacy mode is toggled anywhere in
// the app, so watching it picks up the change without polling the preferences table.
function observeSidebarBalance(callback: () => void): void {
	let stop: (() => void) | null = null;
	// Re-attached whenever Actual renders a new balance: opening or switching budgets.
	const attach = () => {
		stop?.();
		stop = null;
		const target = document.querySelector(BALANCE_SELECTOR);
		if (target) {
			stop = watchDom(callback, target, { childList: true, subtree: true, characterData: true });
		}
	};
	watchElement(BALANCE_SELECTOR, attach);
	attach();
}

export const privacyMode = {
	type: "core" as const,
	init: () => {
		void refreshPrivacyMode();
		observeSidebarBalance(() => void refreshPrivacyMode());
	},
};
