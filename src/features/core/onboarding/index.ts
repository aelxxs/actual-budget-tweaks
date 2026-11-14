import { onSettingsPulled } from "@features/settings-sync";
import { send, waitForBudget } from "@lib/actual/actual-api";
import { isMobileView } from "@lib/actual/pages";
import { BUDGET_LINK } from "@lib/actual-dom";
import { watchDom } from "@lib/dom/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/dom/svelte";
import { getValue, setValue } from "@lib/store";

// Per browser: a budget that already has ABT settings means it's been set up before, elsewhere.
const DONE_KEY = "onboarding-done";
// Longest to wait for the budget's settings to be read before showing anyway.
const PULL_TIMEOUT = 8000;

let shown: Mounted | null = null;

/** Opens the welcome card; also reachable from Tweaks settings' menu as "Getting started". */
export async function openOnboarding(): Promise<void> {
	if (shown) {
		return;
	}
	// Loaded on open: the card reaches the theme and sidebar code, which leads back to the registry.
	const { default: Onboarding } = await import("./Onboarding.svelte");
	if (shown) {
		return;
	}
	// Assigned below; declared first in case the watcher runs as it's added.
	let stop = () => {};
	const remove = () => {
		stop();
		card.destroy();
		shown = null;
	};
	const card = mountToNodeWithReturn(Onboarding, {
		onClose: () => {
			void setValue(DONE_KEY, true);
			remove();
		},
	});
	shown = card;
	// Closing the budget takes it away, unseen: its choices are about the budget that was open.
	stop = watchDom(() => {
		if (!document.querySelector(BUDGET_LINK)) {
			remove();
		}
	});
	document.body.appendChild(card.node);
}

function settingsRead(): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(done, PULL_TIMEOUT);
		const stop = onSettingsPulled(done);
		function done() {
			clearTimeout(timer);
			stop();
			resolve();
		}
	});
}

async function maybeShow(): Promise<void> {
	if (isMobileView() || (await getValue(DONE_KEY, false))) {
		return;
	}
	await waitForBudget();
	const prefs = await send<Record<string, string | null | undefined>>("preferences/get");
	if (Object.entries(prefs).some(([key, value]) => key.startsWith("abt:") && value != null)) {
		await setValue(DONE_KEY, true);
		return;
	}
	// Choices made before then would be overwritten by the budget's, and wouldn't sync to it.
	await settingsRead();
	await openOnboarding();
}

/** Welcomes a new install once, on desktop, with a few choices to get started. */
export const onboarding = {
	type: "core" as const,
	// Not awaited: it waits for a budget to open, which mustn't hold up the other features.
	init: () => void maybeShow(),
};
