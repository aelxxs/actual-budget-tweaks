/**
 * Actual's "N uncategorized transactions" button, present only while some exist.
 * It's a direct child of the top bar, the closest ancestor holding both test-id'd
 * buttons; the bar's other controls sit in wrapper divs.
 */
export function findUncategorizedButton(): HTMLButtonElement | null {
	const notifications = document.querySelector('[data-testid="notifications-button"]');
	const help = document.querySelector('[data-testid="help-menu-button"]');
	if (notifications && help) {
		let bar = notifications.parentElement;
		while (bar && !bar.contains(help)) bar = bar.parentElement;
		return bar?.querySelector<HTMLButtonElement>(":scope > button") ?? null;
	}

	// Older layouts without those test ids.
	for (const btn of document.querySelectorAll<HTMLButtonElement>("button")) {
		if (btn.textContent?.includes("uncategorized")) return btn;
	}
	return null;
}
