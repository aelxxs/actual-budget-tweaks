import { onSyncedPref } from "@lib/utilities/actual-api";
import { Page, setSidebarPages } from "@lib/utilities/pages";
import { untrack } from "svelte";
import {
	Banknote,
	ChartColumn,
	ClipboardList,
	LayoutGrid,
	type LucideIcon,
	SlidersHorizontal,
	Tag,
	Users,
} from "@lucide/svelte";

export interface NavItem {
	label: string;
	page: Page;
	icon: LucideIcon;
}

// Actual's sidebar menu ids, in its default order (actualbudget/actual#9193).
const ITEMS: NavItem[] = [
	{ label: "Budget", page: Page.Budget, icon: LayoutGrid },
	{ label: "Reports", page: Page.Reports, icon: ChartColumn },
	{ label: "Schedules", page: Page.Schedules, icon: ClipboardList },
	{ label: "Payees", page: Page.Payees, icon: Users },
	{ label: "Tags", page: Page.Tags, icon: Tag },
	{ label: "Rules", page: Page.Rules, icon: SlidersHorizontal },
	{ label: "Bank Sync", page: Page.BankSync, icon: Banknote },
];
const LOCKED: readonly Page[] = [Page.Budget, Page.Reports];
const SHOWN_BY_DEFAULT: readonly Page[] = [...LOCKED, Page.Schedules];

interface MenuEntry {
	item: NavItem;
	hidden: boolean;
}

/** Actual's `sidebar-menu-items` pref, read the way Actual reads it: unknown ids dropped, missing ones slotted in at their default place. */
export function parseMenu(raw: string | null): MenuEntry[] {
	const saved: MenuEntry[] = [];
	try {
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		for (const entry of Array.isArray(parsed) ? parsed : []) {
			const item = ITEMS.find((i) => i.page === entry?.id);
			if (item && !saved.some((s) => s.item === item)) {
				saved.push({ item, hidden: entry.hidden === true && !LOCKED.includes(item.page) });
			}
		}
	} catch {
		saved.length = 0;
	}
	ITEMS.forEach((item, defaultIdx) => {
		if (saved.some((s) => s.item === item)) {
			return;
		}
		const at = saved.findIndex((s) => ITEMS.indexOf(s.item) > defaultIdx);
		const entry = { item, hidden: !SHOWN_BY_DEFAULT.includes(item.page) };
		saved.splice(at === -1 ? saved.length : at, 0, entry);
	});
	return saved;
}

let menu = $state(parseMenu(null));
let users = 0;
let stop: (() => void) | null = null;

/** Pages shown in the sidebar, in the order the user set in Actual. */
export function mainItems(): NavItem[] {
	return menu.filter((e) => !e.hidden).map((e) => e.item);
}

/** The shown pages that can't be hidden, and the ones the user chose to show. */
export function lockedItems(): NavItem[] {
	return mainItems().filter((i) => LOCKED.includes(i.page));
}

export function optionalItems(): NavItem[] {
	return mainItems().filter((i) => !LOCKED.includes(i.page));
}

/** Pages the user moved under Settings. */
export function settingsItems(): NavItem[] {
	return menu.filter((e) => e.hidden).map((e) => e.item);
}

/** Follows Actual's sidebar menu settings while a component that reads them is mounted. */
export function trackSidebarMenu(): () => void {
	// The bridge answers synchronously; reading `menu` here would make the caller's effect depend on it.
	untrack(() => {
		if (users++ === 0) {
			stop = onSyncedPref("sidebar-menu-items", (raw) => {
				const next = parseMenu(raw);
				menu = next;
				setSidebarPages(next.filter((e) => !e.hidden).map((e) => e.item.page));
			});
		}
	});
	return () => {
		if (--users === 0) {
			stop?.();
			stop = null;
		}
	};
}
