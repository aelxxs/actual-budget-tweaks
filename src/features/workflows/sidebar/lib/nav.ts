import { Page } from "@lib/actual/pages";
import { TWEAKS_HASH, TWEAKS_PATH } from "@lib/actual/settings-page";
import { type NavItem, settingsItems } from "./menu.svelte";
import {
	Banknote,
	ClipboardList,
	Cog,
	FlaskConical,
	Puzzle,
	type LucideIcon,
	Settings,
	Settings2,
	Tag,
	Users,
	Wrench,
} from "@lucide/svelte";

export const settingsItem = { label: "Settings", page: Page.Settings, icon: Settings };

/** ABT's own settings: the Tweaks tab on Actual's General settings page. */
export const tweaksItem = { label: "Tweaks", path: TWEAKS_PATH, icon: Puzzle };

/** Whether the Tweaks tab is open, which shares General's path. Read with `route()` to follow it. */
export function isTweaksOpen(): boolean {
	return location.hash === TWEAKS_HASH;
}

/** Settings' own page, then the pages the user moved under it. */
export function settingsMenu(): NavItem[] {
	return [{ label: "General", page: Page.Settings, icon: Wrench }, ...settingsItems()];
}

/** Icons for Actual's settings nav (actualbudget/actual#9110), by its links' last path segment. */
export const settingsNavIcons: Record<string, LucideIcon> = {
	general: Wrench,
	schedules: ClipboardList,
	payees: Users,
	tags: Tag,
	rules: Settings2,
	"bank-sync": Banknote,
	advanced: Cog,
	experimental: FlaskConical,
};
