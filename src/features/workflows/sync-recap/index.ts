import { sidepanel } from "@features/core/side-panel";
import { defineSetting } from "@features/types";
import {
	dismissNotification,
	dispatch,
	notify,
	onImported,
	query,
	type ImportResult,
} from "@lib/utilities/actual-api";
import { loadCurrency } from "@lib/utilities/currency";
import { createElement } from "@lib/utilities/dom";
import { mount, unmount } from "svelte";
import { loadCategoryGroups, loadTransactions, setCategory } from "./data";
import Recap from "./Recap.svelte";

const PANEL_KEY = "sync-recap";

let instance: ReturnType<typeof mount> | null = null;
// Sticky, so a newer sync's toast replaces it rather than stacking up.
let lastToast: string | null = null;

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

async function failedNames(ids: string[]): Promise<string[]> {
	if (!ids.length) return [];
	const rows = await query<{ name: string }[]>("accounts", {
		filter: { id: { $oneof: ids } },
		select: ["name"],
	});
	return rows.map((r) => r.name);
}

async function openRecap(result: ImportResult): Promise<void> {
	const [transactions, groups, failed] = await Promise.all([
		loadTransactions(result.added),
		loadCategoryGroups(),
		failedNames(result.failed),
	]);
	if (instance) unmount(instance);
	// Fills the panel and scrolls inside it, like mountToPanelBody, but keeps the instance.
	const node = createElement("div", {
		style: {
			display: "flex",
			flex: "1",
			flexDirection: "column",
			height: "100%",
			minHeight: "0px",
			overflow: "hidden",
		},
	});
	instance = mount(Recap, {
		target: node,
		props: {
			transactions,
			groups,
			matched: result.matched.length,
			failed,
			onCategorize: async (id: string, category: string) => {
				await setCategory(id, category);
				// Actual drops its own "new" styling once a transaction is edited; do the same.
				await dispatch("updateNewTransactions", { id });
			},
			onDone: () => sidepanel.close(),
		},
	});
	sidepanel.open({ title: "Sync recap", bodyNode: node, stack: true, key: PANEL_KEY });
}

async function announce(result: ImportResult): Promise<void> {
	if (!result.added.length) return;
	await loadCurrency();
	const transactions = await loadTransactions(result.added);
	if (!transactions.length) return;
	const accounts = new Set(transactions.map((t) => t.account)).size;
	const uncategorized = transactions.filter((t) => t.needsCategory && !t.category).length;
	if (lastToast) void dismissNotification(lastToast);
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
		{ title: "Review", action: () => openRecap(result) },
	);
}

export const syncRecap = defineSetting({
	type: "checkbox",
	label: "Sync recap",
	description:
		"After a bank sync or import, review what came in and categorize it in the side panel.",
	icon: "download",
	group: "Accounts",
	writes: "Sets a transaction's category when you pick one in the recap.",
	context: {
		key: "sync-recap",
		defaultValue: true,
	},
	init: () => {
		const stop = onImported((result) => void announce(result));
		return () => {
			stop();
			if (instance) unmount(instance);
			instance = null;
		};
	},
});
