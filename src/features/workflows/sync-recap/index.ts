import { sidepanel } from "@features/core/side-panel";
import { defineSetting } from "@features/types";
import { HELP_BUTTON } from "@lib/actual-dom";
import { dismissNotification, notify, onImported, type ImportResult } from "@lib/actual/actual-api";
import { loadCurrency } from "@lib/format/currency";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn, mountToPanelBody } from "@lib/dom/svelte";
import { loadTransactions } from "./data";
import { withBatch } from "./queue";
import { followQueue, updateQueue } from "./queue-state.svelte";
import Recap from "./Recap.svelte";
import ReviewButton from "./ReviewButton.svelte";

const PANEL_KEY = "sync-recap";
const BUTTON_ATTR = "data-abt-review";
// Actual's uncategorized link, whose auto margin the review count takes over.
const UNCATEGORIZED_ATTR = "data-abt-review-after";

let recap: Mounted | null = null;
// Sticky, so a newer sync's toast replaces it rather than stacking up.
let lastToast: string | null = null;

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Opens the recap, on one account's transactions when given one. */
export function openRecap(account?: string): void {
	recap?.destroy();
	recap = mountToPanelBody(Recap, {
		account: account ?? null,
		onDone: () => sidepanel.close(PANEL_KEY),
	});
	sidepanel.open({
		title: "Sync recap",
		bodyNode: recap.node,
		stack: true,
		key: PANEL_KEY,
		scope: "app",
	});
}

async function onSync(result: ImportResult): Promise<void> {
	await loadCurrency();
	const transactions = await loadTransactions(result.added);
	if (!transactions.length) {
		return;
	}
	await updateQueue((q) =>
		withBatch(
			q,
			transactions.map((t) => t.id),
			Date.now(),
		),
	);
	const accounts = new Set(transactions.map((t) => t.account)).size;
	const uncategorized = transactions.filter((t) => t.needsCategory && !t.category).length;
	if (lastToast) {
		void dismissNotification(lastToast);
	}
	lastToast = await notify(
		{
			title: `Imported ${plural(transactions.length, "transaction")}`,
			message:
				`Across ${plural(accounts, "account")}.` +
				(uncategorized
					? ` ${uncategorized} need${uncategorized === 1 ? "s" : ""} a category.`
					: ""),
			sticky: true,
		},
		{ title: "Review", action: () => openRecap() },
	);
}

/** Puts the review count in Actual's titlebar, right after its uncategorized count. */
function placeButton(): () => void {
	let host: HTMLElement | null = null;
	let button: Mounted | null = null;
	let marked: HTMLElement | null = null;

	const unwatch = watchDom(() => {
		const bar = document.querySelector(HELP_BUTTON)?.parentElement?.parentElement ?? null;
		if (!bar) {
			return;
		}
		if (!host) {
			host = document.createElement("div");
			host.setAttribute(BUTTON_ATTR, "");
			// The auto margin Actual gives its uncategorized link, so both pills sit on the left.
			Object.assign(host.style, { display: "flex", alignItems: "center", marginRight: "auto" });
			button = mountToNodeWithReturn(
				ReviewButton,
				{ onOpen: () => openRecap() },
				host as HTMLDivElement,
			);
		}
		// Actual's uncategorized link: the bar's text-only button, there when anything is uncategorized.
		const after = bar.querySelector<HTMLElement>(":scope > button:not(:has(svg))");
		if (after !== marked) {
			marked?.removeAttribute(UNCATEGORIZED_ATTR);
			after?.setAttribute(UNCATEGORIZED_ATTR, "");
			marked = after;
		}
		const placed =
			host.parentElement === bar &&
			(after ? after.nextElementSibling === host : bar.firstElementChild === host);
		if (!placed) {
			bar.insertBefore(host, after ? after.nextSibling : bar.firstChild);
		}
	});

	return () => {
		unwatch();
		button?.destroy();
		host?.remove();
		host = null;
		marked?.removeAttribute(UNCATEGORIZED_ATTR);
		marked = null;
	};
}

export const syncRecap = defineSetting({
	type: "checkbox",
	label: "Sync recap",
	description: "Lists what each bank sync or import added, for you to review.",
	icon: "download",
	group: "Accounts",
	writes: "Sets a transaction's category when you pick one in the recap.",
	guide: "/guides/sync-recap",
	context: {
		key: "sync-recap",
		defaultValue: true,
	},
	init: () => {
		const stopQueue = followQueue();
		const stopImports = onImported((result) => void onSync(result));
		const stopButton = placeButton();
		return () => {
			stopImports();
			stopButton();
			stopQueue();
			recap?.destroy();
			recap = null;
		};
	},
});
