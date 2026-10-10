import { query } from "@lib/utilities/actual-api";

const PRIVACY_CLASS = "abt-privacy-enabled";

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

export const privacyMode = {
	type: "core" as const,
	init: () => {
		void refreshPrivacyMode();
		// The bridge reports each toggle from Actual's store, on any page and for any budget.
		document.addEventListener("abt:api:privacy", (e) => {
			const { on } = JSON.parse((e as CustomEvent<string>).detail) as { on: boolean };
			privacyModeEnabled = on;
			setPrivacyModeClass(on);
		});
	},
};
