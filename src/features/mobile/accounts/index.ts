import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import AccountsList from "./AccountsList.svelte";
import { LISTBOX, MOBILE_ACCOUNT_ROW } from "@lib/actual-dom";

// Actual's accounts page: a container holding its headings and account lists, inside the page's
// pull-to-refresh. ABT's list goes in the same container, so the header and pull-to-refresh stay.
const CONTAINER_ATTR = "data-abt-m-accounts";
const OWN_ATTR = "data-abt-m-accounts-own";

export const mobileAccounts = defineSetting({
	type: "checkbox",
	label: "Accounts",
	description: "Lists accounts in your sidebar groups, with their icons and group totals.",
	group: "Mobile",
	icon: "wallet",
	platform: "mobile",
	context: {
		key: "mobile-accounts",
		defaultValue: false,
	},
	css: () => `
		[${CONTAINER_ATTR}] > :not([${OWN_ATTR}]) {
			display: none !important;
		}
	`,
	init: () => {
		let mounted: (Mounted & { container: Element }) | null = null;
		const stop = watchDom(() => {
			if (mounted && !mounted.node.isConnected) {
				mounted.destroy();
				mounted.container.removeAttribute(CONTAINER_ATTR);
				mounted = null;
			}
			if (mounted) {
				return;
			}
			const container = document.querySelector(MOBILE_ACCOUNT_ROW)?.closest(LISTBOX)?.parentElement;
			if (!container) {
				return;
			}
			const list = mountToNodeWithReturn(AccountsList, {});
			list.node.setAttribute(OWN_ATTR, "");
			container.appendChild(list.node);
			container.setAttribute(CONTAINER_ATTR, "");
			mounted = { ...list, container };
		});
		return () => {
			stop();
			mounted?.destroy();
			mounted?.container.removeAttribute(CONTAINER_ATTR);
		};
	},
});
