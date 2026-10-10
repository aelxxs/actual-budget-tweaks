import { defineSetting } from "@features/types";
import { fmtMoney, loadCurrency } from "@lib/utilities/currency";
import { watchDom } from "@lib/utilities/dom-watcher";

const DAILY_ID = "daily";

/**
 * Cents from a balance as Actual displays it, in any number format: the decimals are a final
 * "." or "," with one or two digits after it, and every other separator groups thousands.
 */
function parseCents(text: string): number | null {
	const t = text.replace(/[^\d.,-]/g, "");
	const decimals = t.match(/[.,](\d{1,2})$/);
	const whole = (decimals ? t.slice(0, -decimals[0].length) : t).replace(/[^\d]/g, "");
	if (!whole && !decimals) return null;
	const cents = Number(whole || 0) * 100 + Number((decimals?.[1] ?? "0").padEnd(2, "0"));
	return t.includes("-") ? -cents : cents;
}

/** What's left to spend each day, today included, or null when there's nothing to spread. */
function dailyAllowance(cents: number): { perDay: number; days: number } | null {
	if (cents <= 0) return null;
	const today = new Date();
	const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
	const days = lastDay - today.getDate() + 1;
	return { perDay: Math.floor(cents / days), days };
}

function displayDailyBalance() {
	const balanceBtn = document.querySelector("*[data-testid=account-balance]");
	let dailyNode = document.querySelector<HTMLElement>(`#${DAILY_ID}`);
	if (!balanceBtn) return;

	// Without privacy mode's redacted copy of the amount, which sits beside the real one.
	const shown = balanceBtn.cloneNode(true) as Element;
	for (const copy of shown.querySelectorAll('[aria-hidden="true"]')) copy.remove();
	const cents = parseCents(shown.textContent ?? "");
	const daily = cents == null ? null : dailyAllowance(cents);
	// Shown with Actual's own balance details, as a copy of the first one.
	const template = (dailyNode ?? balanceBtn).nextElementSibling;
	if (!daily || !template) {
		dailyNode?.remove();
		return;
	}
	if (!dailyNode) {
		dailyNode = template.cloneNode(true) as HTMLElement;
		dailyNode.id = DAILY_ID;
		balanceBtn.after(dailyNode);
	}

	const label = "Daily";
	const value = fmtMoney(daily.perDay);
	const title = `${value} a day for the ${daily.days} ${daily.days === 1 ? "day" : "days"} left this month`;
	if (dailyNode.childNodes[0]?.textContent !== label) dailyNode.childNodes[0].textContent = label;
	// Our own amount in place of the copied one, whose privacy wrapper Actual no longer updates.
	const amount = dailyNode.lastElementChild;
	let number = amount?.querySelector(":scope > .abt-privacy-number");
	if (amount && !number) {
		number = document.createElement("span");
		number.className = "abt-privacy-number";
		amount.replaceChildren(number);
	}
	if (number && number.textContent !== value) number.textContent = value;
	if (dailyNode.title !== title) dailyNode.title = title;
}

function cleanup() {
	document.querySelector(`#${DAILY_ID}`)?.remove();
}

export const showDailyAvailable = defineSetting({
	type: "checkbox",
	label: "Show Daily Available",
	description: "Show what an account's balance allows per day for the rest of the month.",
	group: "Budget",
	icon: "calculator",
	context: {
		key: "actual-daily",
		defaultValue: true,
	},
	init: () => {
		void loadCurrency().then(displayDailyBalance);
		const unwatch = watchDom(displayDailyBalance);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
