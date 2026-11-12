import { sidepanel } from "@features/core/side-panel";
import { type Mounted, mountToPanelBody } from "@lib/utilities/svelte";
import ReconcilePanel from "./ReconcilePanel.svelte";
import { reconcile } from "./state.svelte";

const PANEL_KEY = "reconcile";

let current:
	| (Mounted & {
			accountId: string;
			/** The panel mounts its body after opening, so it only counts as closed once it was shown. */
			shown: boolean;
	  })
	| null = null;

export function openPanel(accountId: string): void {
	if (current?.accountId !== accountId) {
		destroyPanel();
	}
	if (!current) {
		current = { ...mountToPanelBody(ReconcilePanel, { accountId }), accountId, shown: false };
	}
	current.shown = false;
	// The panel sets the account's name once loaded; reopening must not put "Reconcile" back.
	const title =
		reconcile.accountId === accountId && reconcile.accountName
			? reconcile.accountName
			: "Reconcile";
	sidepanel.open({ title, bodyNode: current.node, key: PANEL_KEY });
}

export function isPanelShowing(): boolean {
	return !!current?.node.isConnected;
}

/** True once the panel was shown and then closed, or another feature took its place. */
export function panelWasClosed(): boolean {
	if (!current) {
		return false;
	}
	if (current.node.isConnected) {
		current.shown = true;
	}
	return current.shown && !current.node.isConnected;
}

export function closePanel(): void {
	sidepanel.close(PANEL_KEY);
	destroyPanel();
}

export function destroyPanel(): void {
	if (!current) {
		return;
	}
	current.destroy();
	current = null;
}
