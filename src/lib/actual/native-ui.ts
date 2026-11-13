import {
	ACCOUNT_NAME,
	ALL_ACCOUNTS_BALANCE,
	HELP_BUTTON,
	NOTIFICATIONS_BUTTON,
} from "@lib/actual-dom";
/**
 * Actual's "N uncategorized transactions" button, present only while some exist.
 * It's a direct child of the top bar, the closest ancestor holding both test-id'd
 * buttons; the bar's other controls sit in wrapper divs.
 */
export function findUncategorizedButton(): HTMLButtonElement | null {
	const notifications = document.querySelector(NOTIFICATIONS_BUTTON);
	const help = document.querySelector(HELP_BUTTON);
	if (notifications && help) {
		let bar = notifications.parentElement;
		while (bar && !bar.contains(help)) {
			bar = bar.parentElement;
		}
		return bar?.querySelector<HTMLButtonElement>(":scope > button") ?? null;
	}

	// Older layouts without those test ids.
	for (const btn of document.querySelectorAll<HTMLButtonElement>("button")) {
		if (btn.textContent?.includes("uncategorized")) {
			return btn;
		}
	}
	return null;
}

const TOOLBAR_SHAPE = "div:has(> div:empty):has(> div > input)";

/**
 * The account page's toolbar: the last child of the header whose first child holds the account
 * name, with an empty flex spacer and the search input. Walked up from the name, since the
 * equivalent :has() selector is costly enough to slow the transaction table.
 */
export function findAccountToolbar(): HTMLElement | null {
	const name = document.querySelector(ACCOUNT_NAME);
	for (let el = name?.parentElement; el?.parentElement; el = el.parentElement) {
		const last = el.parentElement.lastElementChild;
		if (el === el.parentElement.firstElementChild && last?.matches(TOOLBAR_SHAPE)) {
			return last as HTMLElement;
		}
	}
	return null;
}

/** Actual's sidebar root: the first ancestor of its balance that sizes itself inline. */
export function findNativeSidebarRoot(): HTMLElement | null {
	let el = document.querySelector(ALL_ACCOUNTS_BALANCE)?.parentElement ?? null;
	while (el) {
		if (el.style.flexShrink === "0" && el.style.minWidth) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}
