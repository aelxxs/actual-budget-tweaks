import { sidepanel } from "@features/core/side-panel";
import { mount, unmount } from "svelte";
import ReconcilePanel from "./ReconcilePanel.svelte";
import { reconcile } from "./state.svelte";

const PANEL_WIDTH = 340;

let current: {
	accountId: string;
	node: HTMLDivElement;
	instance: Record<string, unknown>;
	/** The panel mounts its body after opening, so it only counts as closed once it was shown. */
	shown: boolean;
} | null = null;

export function openPanel(accountId: string, animate = true): void {
	if (current?.accountId !== accountId) destroyPanel();
	if (!current) {
		// Fills the panel body and scrolls inside, like mountToPanelBody, but keeps the instance.
		const node = document.createElement("div");
		node.style.cssText =
			"display: flex; flex: 1; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;";
		const instance = mount(ReconcilePanel, { target: node, props: { accountId } });
		current = { accountId, node, instance, shown: false };
	}
	current.shown = false;
	// The panel sets the account's name once loaded; reopening must not put "Reconcile" back.
	const title =
		reconcile.accountId === accountId && reconcile.accountName
			? reconcile.accountName
			: "Reconcile";
	sidepanel.open({ title, bodyNode: current.node, width: PANEL_WIDTH, animate });
}

export function isPanelShowing(): boolean {
	return !!current?.node.isConnected;
}

/** True once the panel was shown and then closed, or another feature took its place. */
export function panelWasClosed(): boolean {
	if (!current) return false;
	if (current.node.isConnected) current.shown = true;
	return current.shown && !current.node.isConnected;
}

export function closePanel(): void {
	if (isPanelShowing()) sidepanel.close();
	destroyPanel();
}

export function destroyPanel(): void {
	if (!current) return;
	void unmount(current.instance);
	current.node.remove();
	current = null;
}
