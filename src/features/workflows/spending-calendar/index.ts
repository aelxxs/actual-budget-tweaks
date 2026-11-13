import { NAV_BORDER_CSS } from "@features/layout/borders";
import { addNativeNavLink, followOverlayPage, openOverlayPage } from "@features/core/overlay-page";
import { defineSetting } from "@features/types";
import { Page } from "@lib/actual/pages";
import Calendar from "./Calendar.svelte";

const CALENDAR_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="7" y="13" width="3" height="3" rx="0.5"/><rect x="14" y="13" width="3" height="3" rx="0.5"/></svg>`;

export function openCalendar(): void {
	openOverlayPage(Page.Calendar, Calendar);
}

export const spendingCalendar = defineSetting({
	type: "checkbox",
	label: "Spending calendar",
	description: "A page showing daily spending on a calendar, opened from the sidebar.",
	icon: "calendar",
	context: {
		key: "spending-calendar-enabled",
		defaultValue: false,
	},
	css: () => NAV_BORDER_CSS,
	init: () => {
		const stopFollowing = followOverlayPage(Page.Calendar, openCalendar);
		const removeLink = addNativeNavLink({
			attr: "data-abt-calendar-link",
			label: "Calendar",
			iconSvg: CALENDAR_ICON,
			page: Page.Calendar,
			open: openCalendar,
		});
		return () => {
			removeLink();
			stopFollowing();
		};
	},
});
