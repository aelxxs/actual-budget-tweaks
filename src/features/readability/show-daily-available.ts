import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";

function getDailyBalance(balanceText: string) {
	const balance = parseFloat(balanceText.replace(",", ".").replace(" ", ""));
	const today = new Date();
	const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

	const remainingDays = lastDay.getDate() - today.getDate();

	let perTomorrow;
	if (remainingDays > 0) {
		perTomorrow = balance / remainingDays;
	}

	const perDay = balance / (remainingDays + 1);

	let dailyBalance = `${perDay.toFixed(2)}`;
	if (perTomorrow) {
		dailyBalance += ` | ${perTomorrow.toFixed(2)}`;
	}

	return dailyBalance;
}

function displayDailyBalance() {
	const balanceBtn = document.querySelector("*[data-testid=account-balance]");
	let dailyNode = document.querySelector("#daily");

	if (balanceBtn) {
		if (!dailyNode && balanceBtn.nextSibling) {
			dailyNode = balanceBtn.nextSibling.cloneNode(true) as HTMLElement;
			dailyNode.id = "daily";
			balanceBtn.after(dailyNode);
		}
		if (dailyNode && dailyNode.childNodes[0]) {
			dailyNode.childNodes[0].textContent = "Daily:";
		}
		if (dailyNode && dailyNode.lastChild) {
			dailyNode.lastChild.textContent = getDailyBalance(balanceBtn.textContent ?? "");
		}
		if (dailyNode && dailyNode.nextSibling === null) {
			dailyNode.remove();
		}
	}
}

function cleanup() {
	document.querySelector("#daily")?.remove();
}

export const showDailyAvailable = defineSetting({
	type: "checkbox",
	label: "Show Daily Available",
	context: {
		key: "actual-daily",
		defaultValue: true,
	},
	init: () => {
		const unwatch = watchDom(displayDailyBalance, undefined, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		return () => {
			unwatch();
			cleanup();
		};
	},
});
