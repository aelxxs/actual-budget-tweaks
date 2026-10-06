import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { getCurrentPath } from "@lib/utilities/route-watcher";
import { mountToNodeWithReturn } from "@lib/utilities/svelte";
import { unmount } from "svelte";
import { NATIVE_LOCK, TOOLBAR } from "./dom";
import { closePanel, destroyPanel, panelWasClosed } from "./panel";
import ReconcileButton from "./ReconcileButton.svelte";
import { cancel, reconcile } from "./state.svelte";

/*
 * Replaces Actual's reconcile popover and banner with a side panel. Its lock button is found by
 * its glyph (labels are translated) and hidden; ours joins the actions, showing how long it's been.
 */
const OURS = "data-abt-reconcile";
const ACCOUNT_PATH = /^\/accounts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

const CSS = `
	${TOOLBAR} > div:has(${NATIVE_LOCK}):not([${OURS}]) {
		display: none !important;
	}
`;

let mounted: { accountId: string; node: HTMLElement; instance: unknown } | null = null;

function teardown() {
	if (!mounted) return;
	void unmount(mounted.instance as Record<string, unknown>);
	mounted.node.remove();
	mounted = null;
}

function sync() {
	// Re-entering the account view to refresh it isn't leaving it.
	if (reconcile.refreshing) return;

	// Closing the panel, or another feature taking it, ends the reconcile.
	if (panelWasClosed()) {
		cancel();
		destroyPanel();
	}

	const accountId = getCurrentPath().match(ACCOUNT_PATH)?.[1];
	// Runs on every DOM change: skip the queries while the button is in place.
	if (accountId && mounted?.accountId === accountId && mounted.node.isConnected) return;

	const toolbar = accountId ? document.querySelector<HTMLElement>(TOOLBAR) : null;
	const lockWrapper = toolbar
		? [...toolbar.children].find((c) => !c.hasAttribute(OURS) && c.querySelector(NATIVE_LOCK))
		: null;
	if (!accountId || !lockWrapper) {
		if (mounted) {
			cancel();
			closePanel();
			teardown();
		}
		return;
	}
	if (mounted?.accountId !== accountId) {
		cancel();
		closePanel();
	}
	teardown();

	const button = mountToNodeWithReturn(ReconcileButton, { accountId });
	button.node.setAttribute(OURS, "");
	// With the actions, before Actual's empty flex spacer; beside the lock if that's ever gone.
	const spacer = [...toolbar!.children].find((c) => !c.hasAttribute(OURS) && c.matches(":empty"));
	if (spacer) spacer.before(button.node);
	else lockWrapper.after(button.node);
	mounted = { accountId, node: button.node, instance: button.instance };
}

export const modernReconcile = defineSetting({
	type: "checkbox",
	label: "Modern Reconcile",
	description:
		"Reconcile in a side panel: live balances, clear transactions from a list, one-click adjustment and undo.",
	group: "General",
	icon: "shield",
	context: {
		key: "modern-reconcile",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		sync();
		const stop = watchDom(sync);
		return () => {
			stop();
			cancel();
			closePanel();
			teardown();
		};
	},
});
