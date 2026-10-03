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
} from "lucide-svelte";

export const navItems = [
	{ label: "Budget", page: Page.Budget, icon: LayoutGrid },
	{ label: "Reports", page: Page.Reports, icon: ChartColumn },
	{ label: "Schedules", page: Page.Schedules, icon: Calendar },
];

export const moreItems = [
	{ label: "Payees", page: Page.Payees, icon: Users },
	{ label: "Bank Sync", page: Page.BankSync, icon: Banknote },
	{ label: "Rules", page: Page.Rules, icon: SlidersHorizontal },
	{ label: "Tags", page: Page.Tags, icon: Tag },
	{ label: "Settings", page: Page.Settings, icon: Settings },
];
