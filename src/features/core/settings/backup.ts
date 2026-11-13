import { scripts } from "@features/index";
import { pushStoredSettings } from "@features/settings-sync";
import { isoDate } from "@lib/format/months";

// Stored by features outside any one setting, so an export carries them even before first use.
const AUX_DEFAULTS: Record<string, unknown> = {
	"local:category-colors": {},
	"local:abt-account-icons": {},
	"local:abt-category-icons": {},
	"local:abt-sidebar-shortcuts": [],
	"local:user-themes": {},
	"local:side-panel-width": 420,
	"local:side-panel-persist": null,
	"local:theme-auto-switch": false,
	"local:theme-auto-dark": null,
	"local:theme-auto-light": null,
};

export async function exportSettings(): Promise<void> {
	const stored = await browser.storage.local.get(null);
	const data: Record<string, unknown> = { ...AUX_DEFAULTS, ...stored };
	for (const group of scripts) {
		for (const item of group) {
			if ("context" in item && item.context?.key) {
				const storageKey = `local:${item.context.key}`;
				if (!(storageKey in data)) {
					data[storageKey] = item.context.defaultValue;
				}
			}
		}
	}
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `abt-settings-${isoDate()}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

/** Opens the file picker and replaces every setting with the chosen export. */
export function pickSettingsFile(onDone: (ok: boolean) => void): void {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json";
	input.style.display = "none";
	input.onchange = async () => {
		const file = input.files?.[0];
		input.remove();
		if (!file) {
			return;
		}
		try {
			const data = JSON.parse(await file.text());
			if (typeof data !== "object" || data === null || Array.isArray(data)) {
				throw new Error("Invalid format");
			}
			await browser.storage.local.clear();
			await browser.storage.local.set(data);
			// Otherwise the budget's old values would win again after the reload.
			await pushStoredSettings();
			onDone(true);
		} catch {
			onDone(false);
		}
	};
	// Some browsers (Firefox, Safari) won't reliably open the native file
	// picker from a detached input's synthetic click.
	document.body.appendChild(input);
	input.click();
}

// Writes each default rather than removing the key: removed keys would come back from the
// budget's synced copy. Icons, colours, groups, shortcuts and custom themes are untouched.
export async function resetToDefaults(): Promise<void> {
	const defaults: Record<string, unknown> = {};
	for (const item of scripts.flat()) {
		if (item.type !== "core") {
			defaults[`local:${item.context.key}`] = item.context.defaultValue;
		}
	}
	await browser.storage.local.set(defaults);
	await pushStoredSettings();
}
