import { Page } from "@lib/utilities/pages";
import { type NavItem, settingsItems } from "./menu.svelte";
import {
	Banknote,
	ClipboardList,
	Cog,
	FlaskConical,
	type LucideIcon,
	Settings,
	SlidersHorizontal,
	Tag,
	Users,
	Wrench,
} from "@lucide/svelte";

export const settingsItem = { label: "Settings", page: Page.Settings, icon: Settings };

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
	rules: SlidersHorizontal,
	"bank-sync": Banknote,
	advanced: Cog,
	experimental: FlaskConical,
};
