import { sidepanel } from "@features/core/side-panel";
import { defineSetting } from "@features/types";
import { loadCurrency } from "@lib/utilities/currency";
import { watchDom } from "@lib/utilities/dom-watcher";
import { findAccountToolbar } from "@lib/utilities/native-ui";
import { isUuid } from "@lib/utilities/ids";
import { getCurrentPath } from "@lib/utilities/route-watcher";
import { matchesPage, Page } from "@lib/utilities/pages";
import { type Mounted, mountToNodeWithReturn, mountToPanelBody } from "@lib/utilities/svelte";
import InspectButton from "./InspectButton.svelte";
import Inspector from "./Inspector.svelte";
import { inspector } from "./state.svelte";
import { FOCUS_KEY, SELECT_CELL, TRANSACTION_TABLE } from "@lib/actual-dom";

/*
 * A side panel that follows the transaction you select on an account page. Actual keys each row's
 * wrapper by its transaction id (data-focus-key), and a selected row's checkbox holds a checkmark.
 */
const OURS = "data-abt-inspect";
const PANEL_KEY = "transaction-inspector";
const ROW = `${TRANSACTION_TABLE} ${FOCUS_KEY}`;
const CHECKED = `${SELECT_CELL} svg`;

let button: Mounted | null = null;
let panel: Mounted | null = null;
// Selected ids, oldest first; the panel shows the newest. Actual clears selection between accounts.
let selected: string[] = [];
let selectedOn = "";
/**
 * Updates the selection from the rendered rows. The table only renders what's in view, so a
 * selected row scrolled away keeps its place rather than counting as unselected.
 */
function followSelection() {
	if (getCurrentPath() !== selectedOn) {
		selected = [];
		selectedOn = getCurrentPath();
	}
	const rendered = new Map<string, boolean>();
	for (const row of document.querySelectorAll<HTMLElement>(ROW)) {
		const id = row.dataset.focusKey;
		if (id && isUuid(id)) {
			rendered.set(id, !!row.querySelector(CHECKED));
		}
	}
	selected = selected.filter((id) => rendered.get(id) ?? true);
	for (const [id, checked] of rendered) {
		if (checked && !selected.includes(id)) {
			selected.push(id);
		}
	}
	const newest = selected.at(-1) ?? null;
	if (newest !== inspector.transactionId) {
		inspector.transactionId = newest;
	}
}

async function openPanel() {
	await loadCurrency();
	selected = [];
	followSelection();
	if (!panel) {
		panel = mountToPanelBody(Inspector, { panelKey: PANEL_KEY });
	}
	sidepanel.open({ title: "Inspector", bodyNode: panel.node, key: PANEL_KEY });
	inspector.open = true;
}

function destroyPanel() {
	if (!panel) {
		return;
	}
	if (panel.node.isConnected) {
		sidepanel.close(PANEL_KEY);
	}
	panel.destroy();
	panel = null;
	inspector.open = false;
	inspector.transactionId = null;
	selected = [];
}

function removeButton() {
	if (!button) {
		return;
	}
	button.destroy();
	button = null;
}

function sync() {
	// Closing the panel, or another feature taking it, ends inspecting.
	if (inspector.open && !panel?.node.isConnected) {
		inspector.open = false;
		inspector.transactionId = null;
		selected = [];
	}
	if (inspector.open) {
		followSelection();
	}

	const toolbar = matchesPage(Page.Accounts) ? findAccountToolbar() : null;
	if (!toolbar) {
		removeButton();
		destroyPanel();
		return;
	}
	if (button?.node.isConnected && button.node.parentElement === toolbar) {
		return;
	}

	removeButton();
	const mounted = mountToNodeWithReturn(InspectButton, {
		onclick: () => (inspector.open ? sidepanel.close(PANEL_KEY) : void openPanel()),
	});
	mounted.node.setAttribute(OURS, "");
	// With the actions, before Actual's empty flex spacer.
	const spacer = [...toolbar.children].find((c) => c.matches(":empty"));
	if (spacer) {
		spacer.before(mounted.node);
	} else {
		toolbar.append(mounted.node);
	}
	button = mounted;
}

export const transactionInspector = defineSetting({
	type: "checkbox",
	label: "Transaction inspector",
	description:
		"Shows the selected transaction's payee history, rules and schedule in a side panel.",
	group: "General",
	icon: "eye",
	guide: "/guides/transaction-inspector",
	context: {
		key: "transaction-inspector",
		defaultValue: false,
	},
	init: () => {
		sync();
		const stop = watchDom(sync);
		return () => {
			stop();
			removeButton();
			destroyPanel();
		};
	},
});
