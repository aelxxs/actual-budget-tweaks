import { Page } from "@lib/utilities/pages";
import {
	Banknote,
	Calendar,
	ChartColumn,
	LayoutGrid,
	Settings,
	SlidersHorizontal,
	Tag,
	Users,
	Wrench,
} from "lucide-svelte";

export const navItems = [
	{ label: "Budget", page: Page.Budget, icon: LayoutGrid },
	{ label: "Reports", page: Page.Reports, icon: ChartColumn },
	{ label: "Schedules", page: Page.Schedules, icon: Calendar },
];

export const settingsItem = { label: "Settings", page: Page.Settings, icon: Settings };

/** The pages Actual groups under Settings, in its order. */
export const settingsPages = [
	{ label: "Payees", page: Page.Payees, icon: Users },
	{ label: "Tags", page: Page.Tags, icon: Tag },
	{ label: "Rules", page: Page.Rules, icon: SlidersHorizontal },
	{ label: "Bank Sync", page: Page.BankSync, icon: Banknote },
];

export const settingsMenu = [
	{ label: "General", page: Page.Settings, icon: Wrench },
	...settingsPages,
];
