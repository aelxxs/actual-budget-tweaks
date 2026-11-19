import {
	Bell,
	CalendarDays,
	ChartColumn,
	Circle,
	CreditCard,
	type LucideIcon,
	PiggyBank,
	Settings,
	Settings2,
	Store,
	Wallet,
} from "@lucide/svelte";

/** Actual's slide-up drawer of page links, shown on its main mobile pages. */
/** On <html> while the tab bar shows, for other tweaks that sit above it. */
export const TAB_BAR_ATTR = "data-abt-m-tabbar";
export const ADD_PATH = "/transactions/new";
/** The tabs either side of the add button; everything else in Actual's drawer goes under More. */
export const PRIMARY = ["/budget", "/accounts", "/reports"];

const ICONS: Record<string, LucideIcon> = {
	"/budget": Wallet,
	"/accounts": PiggyBank,
	"/reports": ChartColumn,
	"/schedules": CalendarDays,
	"/payees": Store,
	"/rules": Settings2,
	"/bank-sync": CreditCard,
	"/settings": Settings,
	"/notifications": Bell,
};

export interface NavLink {
	path: string;
	label: string;
	icon: LucideIcon;
}

/** Actual's own links, so its labels (translated) and its choice of pages carry over. */
export function readLinks(nav: Element): NavLink[] {
	return [...nav.querySelectorAll<HTMLAnchorElement>("a[href]")].map((a) => {
		const path = new URL(a.href).pathname;
		return { path, label: a.textContent?.trim() || path.slice(1), icon: ICONS[path] ?? Circle };
	});
}

export function isActive(path: string, current: string): boolean {
	return current === path || current.startsWith(`${path}/`);
}
