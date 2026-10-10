import { defineSetting } from "@features/types";
import { UUID } from "@lib/utilities/ids";
import { watchDom } from "@lib/utilities/dom-watcher";
import { findAccountToolbar } from "@lib/utilities/native-ui";
import { getCurrentPath } from "@lib/utilities/route-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import { NATIVE_LOCK } from "./dom";
import { closePanel, destroyPanel, panelWasClosed } from "./panel";
import ReconcileButton from "./ReconcileButton.svelte";
import { cancel, reconcile } from "./state.svelte";

/*
 * Replaces Actual's reconcile popover and banner with a side panel. Its lock button is found by
 * its glyph (labels are translated) and hidden; ours joins the actions, showing how long it's been.
 */
const OURS = "data-abt-reconcile";
// Marked in JS: a `div:has(<lock path>)` rule made every div on the page search its subtree.
const HIDDEN_LOCK = "data-abt-native-lock";
const ACCOUNT_PATH = new RegExp(`^/accounts/(${UUID})`);

const CSS = `
	[${HIDDEN_LOCK}] {
		display: none !important;
	}
`;

let mounted: (Mounted & { accountId: string }) | null = null;
let hiddenLock: Element | null = null;

function teardown() {
	hiddenLock?.removeAttribute(HIDDEN_LOCK);
	hiddenLock = null;
	if (!mounted) {
		return;
	}
	mounted.destroy();
	mounted = null;
}

function sync() {
	// Re-entering the account view to refresh it isn't leaving it.
	if (reconcile.refreshing) {
		return;
	}

	// Closing the panel, or another feature taking it, ends the reconcile.
	if (panelWasClosed()) {
		cancel();
		destroyPanel();
	}

	const accountId = getCurrentPath().match(ACCOUNT_PATH)?.[1];
	// Runs on every DOM change: skip the queries while the button is in place.
	if (
		accountId &&
		mounted?.accountId === accountId &&
		mounted.node.isConnected &&
		hiddenLock?.isConnected
	) {
		return;
	}

	const toolbar = accountId ? findAccountToolbar() : null;
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
	if (mounted?.accountId === accountId && mounted.node.isConnected) {
		// Only Actual's lock was re-rendered; keep our button and its state.
		hiddenLock?.removeAttribute(HIDDEN_LOCK);
		hiddenLock = lockWrapper;
		hiddenLock.setAttribute(HIDDEN_LOCK, "");
		return;
	}
	if (mounted?.accountId !== accountId) {
		cancel();
		closePanel();
	}
	teardown();
	hiddenLock = lockWrapper;
	hiddenLock.setAttribute(HIDDEN_LOCK, "");

	const button = mountToNodeWithReturn(ReconcileButton, { accountId });
	button.node.setAttribute(OURS, "");
	// With the actions, before Actual's empty flex spacer; beside the lock if that's ever gone.
	const spacer = [...toolbar!.children].find((c) => !c.hasAttribute(OURS) && c.matches(":empty"));
	if (spacer) {
		spacer.before(button.node);
	} else {
		lockWrapper.after(button.node);
	}
	mounted = { ...button, accountId };
}

export const modernReconcile = defineSetting({
	type: "checkbox",
	label: "Modern Reconcile",
	description:
		"Reconcile in a side panel: live balances, clear transactions from a list, one-click adjustment and undo.",
	group: "General",
	icon: "shield",
	writes:
		"Clears transactions you tick, adds an adjustment if you ask, and locks them when you finish.",
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
