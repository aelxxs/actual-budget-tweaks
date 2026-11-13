import { defineSetting } from "@features/types";
import { navigate } from "@lib/utilities/actual-api";
import { UUID } from "@lib/utilities/ids";
import { watchDom } from "@lib/utilities/dom-watcher";
import { findAccountToolbar } from "@lib/utilities/native-ui";
import { getCurrentPath } from "@lib/utilities/route-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import { NATIVE_LOCK } from "./dom";
import { closePanel, destroyPanel, openPanel, panelWasClosed } from "./panel";
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
// Asked for from elsewhere: the panel waits for the button, since arriving at an account closes it.
let requested: string | null = null;

export function currentAccountId(): string | null {
	return getCurrentPath().match(ACCOUNT_PATH)?.[1] ?? null;
}

/** Goes to the account and opens its reconcile panel. */
export function reconcileAccount(accountId: string): void {
	requested = accountId;
	if (currentAccountId() === accountId) {
		sync();
	} else {
		navigate(`/accounts/${accountId}`);
	}
}

function teardown() {
	hiddenLock?.removeAttribute(HIDDEN_LOCK);
	hiddenLock = null;
	if (!mounted) {
		return;
	}
	mounted.destroy();
	mounted = null;
}

function placeButton() {
	// Re-entering the account view to refresh it isn't leaving it.
	if (reconcile.refreshing) {
		return;
	}

	// Closing the panel, or another feature taking it, ends the reconcile.
	if (panelWasClosed()) {
		cancel();
		destroyPanel();
	}

	const accountId = currentAccountId();
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

function sync() {
	placeButton();
	if (requested && mounted?.accountId === requested && mounted.node.isConnected) {
		const accountId = requested;
		requested = null;
		openPanel(accountId);
	}
}

export const modernReconcile = defineSetting({
	type: "checkbox",
	label: "Modern reconcile",
	description: "Reconciles in a side panel that tracks the difference as you clear transactions.",
	group: "General",
	icon: "shield",
	writes:
		"Clears transactions you tick, adds an adjustment if you ask, and locks them when you finish.",
	guide: "/guides/modern-reconcile",
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
			requested = null;
			cancel();
			closePanel();
			teardown();
		};
	},
});
